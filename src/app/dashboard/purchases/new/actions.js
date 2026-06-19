'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPurchaseOrder(payload) {
  try {
    // Dynamically import to avoid circular dependencies if any
    const { recalculateProductPrices } = await import('@/app/actions/pricing')
    const supabase = await createClient()

    // 1. Generate PO Number
    const poNumber = `PO-${Date.now().toString().slice(-6)}`

    // 2. Resolve Supplier (create if new)
    let finalSupplierCode = payload.supplierId;
    if (!finalSupplierCode) {
      return { success: false, error: 'Supplier belum diisi.' }
    }

    const { data: existingSupplier } = await supabase
      .from('suppliers')
      .select('supplier_code')
      .eq('supplier_name', finalSupplierCode)
      .single()

    if (existingSupplier) {
      finalSupplierCode = existingSupplier.supplier_code
    } else {
      const newCode = `SUPP-${Math.floor(Math.random() * 10000)}`
      const { data: newSupplier, error: newSuppError } = await supabase
        .from('suppliers')
        .insert({
          supplier_code: newCode,
          supplier_name: finalSupplierCode,
          contact_person: '',
          phone: '',
          address: ''
        })
        .select('supplier_code')
        .single()
        
      if (!newSuppError && newSupplier) {
        finalSupplierCode = newSupplier.supplier_code
      }
    }

    // 3. Insert Purchase Order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        date: payload.poDate,
        supplier: finalSupplierCode,
        total_amount: payload.grandTotal,
        payment_method: payload.paymentAccount,
        status: payload.paymentStatus,
        workshop_code: payload.items[0]?.workshop_code || null
      })
      .select('id, po_number')
      .single()

    if (poError) {
      console.error('PO Insert Error:', poError)
      return { success: false, error: poError.message }
    }

    // 4. Insert Purchase Items
    const itemsToInsert = payload.items.map(item => ({
      po_id: po.id,
      product_code: item.product_id,
      qty: item.qty,
      unit: item.unit || 'PCS',
      unit_multiplier: item.unit_multiplier || 1,
      unit_price: item.unit_cost,
      total_price: Number(item.qty) * Number(item.unit_multiplier) * Number(item.unit_cost)
    }))

    const { error: itemsError } = await supabase
      .from('purchase_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Items Insert Error:', itemsError)
      // Cleanup PO if items fail
      await supabase.from('purchase_orders').delete().eq('id', po.id)
      return { success: false, error: itemsError.message }
    }

    // 5. Inventory is updated automatically by DB Trigger on purchase_items

    // 6. Recalculate Dynamic Pricing for all affected products
    const uniqueProducts = [...new Set(payload.items.map(i => i.product_id))]
    for (const prodCode of uniqueProducts) {
      await recalculateProductPrices(prodCode)
    }

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/purchases')
    revalidatePath('/dashboard')
    revalidatePath('/pricelist')

    return { success: true, po_number: po.po_number }
  } catch (error) {
    console.error('Action Exception:', error)
    return { success: false, error: error.message || 'Terjadi kesalahan sistem.' }
  }
}

export async function updatePurchaseOrder(id, payload) {
  try {
    const { recalculateProductPrices } = await import('@/app/actions/pricing')
    const supabase = await createClient()
    // 1. Stock reverting is automatically handled by DB Trigger on purchase_items BEFORE DELETE
    const { data: oldItems } = await supabase.from('purchase_items').select('*').eq('po_id', id)
    
    if (oldItems && oldItems.length > 0) {
       // Just fetch old items for pricing recalculation later
    }

    // 2. We will handle deletion carefully later

    // 3. Update Purchase Order
    let finalSupplierCode = payload.supplierId;
    if (finalSupplierCode) {
      const { data: existingSupplier } = await supabase
        .from('suppliers')
        .select('supplier_code')
        .eq('supplier_name', finalSupplierCode)
        .single()

      if (existingSupplier) {
        finalSupplierCode = existingSupplier.supplier_code
      } else {
        const newCode = `SUPP-${Math.floor(Math.random() * 10000)}`
        const { data: newSupplier, error: newSuppError } = await supabase
          .from('suppliers')
          .insert({
            supplier_code: newCode,
            supplier_name: finalSupplierCode,
            contact_person: '',
            phone: '',
            address: ''
          })
          .select('supplier_code')
          .single()
          
        if (!newSuppError && newSupplier) {
          finalSupplierCode = newSupplier.supplier_code
        }
      }
    }
    const { error: poError } = await supabase
      .from('purchase_orders')
      .update({
        date: payload.poDate,
        supplier: finalSupplierCode,
        total_amount: payload.grandTotal,
        payment_method: payload.paymentAccount,
        status: payload.paymentStatus,
        workshop_code: payload.items[0]?.workshop_code || null
      })
      .eq('id', id)

    if (poError) throw new Error(poError.message)

    // 4. Upsert Purchase Items
    const itemsToInsert = payload.items.map(item => {
      const isExisting = String(item.id).length > 20;
      const data = {
        po_id: id,
        product_code: item.product_id,
        qty: item.qty,
        unit: item.unit || 'PCS',
        unit_multiplier: item.unit_multiplier || 1,
        unit_price: item.unit_cost,
        total_price: Number(item.qty) * Number(item.unit_multiplier) * Number(item.unit_cost)
      }
      if (isExisting) {
        data.id = item.id;
      }
      return data;
    })

    const existingItemIds = itemsToInsert.filter(i => i.id).map(i => i.id);

    // Delete items that were removed in the UI
    if (existingItemIds.length > 0) {
      await supabase.from('purchase_items').delete().eq('po_id', id).not('id', 'in', `(${existingItemIds.join(',')})`);
    } else {
      await supabase.from('purchase_items').delete().eq('po_id', id);
    }

    const { error: itemsError } = await supabase.from('purchase_items').upsert(itemsToInsert)
    if (itemsError) throw new Error(itemsError.message)

    // 5. Inventory is updated automatically by DB Trigger on purchase_items

    // 6. Recalculate Dynamic Pricing for all affected products
    const uniqueProducts = [...new Set(payload.items.map(i => i.product_id))]
    for (const prodCode of uniqueProducts) {
      await recalculateProductPrices(prodCode)
    }

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/purchases')
    revalidatePath('/dashboard')
    revalidatePath('/pricelist')

    return { success: true }
  } catch (error) {
    console.error('Update PO Error:', error)
    return { success: false, error: error.message || 'Terjadi kesalahan sistem saat update.' }
  }
}

export async function deletePurchaseOrder(id) {
  try {
    const { recalculateProductPrices } = await import('@/app/actions/pricing')
    const supabase = await createClient()

    // 1. Stock reverting is automatically handled by DB Trigger on purchase_items ON DELETE
    const { data: oldItems } = await supabase.from('purchase_items').select('*').eq('po_id', id)

    // 2. Delete PO (Items will cascade if ON DELETE CASCADE, but we already reverted stock)
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (error) throw new Error(error.message)

    // 3. Recalculate Dynamic Pricing for affected products
    if (oldItems && oldItems.length > 0) {
      const uniqueProducts = [...new Set(oldItems.map(i => i.product_code))]
      for (const prodCode of uniqueProducts) {
        await recalculateProductPrices(prodCode)
      }
    }

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/purchases')
    revalidatePath('/dashboard')
    revalidatePath('/pricelist')

    return { success: true }
  } catch (error) {
    console.error('Delete PO Error:', error)
    return { success: false, error: error.message || 'Terjadi kesalahan sistem saat hapus.' }
  }
}

export async function payPurchaseOrder(id, paymentMethod) {
  try {
    const supabase = await createClient()

    // 1. Ambil data PO
    const { data: po, error: poError } = await supabase.from('purchase_orders').select('*').eq('id', id).single()
    if (poError || !po) throw new Error('Data PO tidak ditemukan.')

    if (po.status === 'LUNAS') throw new Error('PO sudah lunas.')

    // 2. Insert ke transaksi (buku besar)
    const { error: txError } = await supabase.from('transactions').insert({
      date: new Date().toISOString().split('T')[0],
      reference: 'PEMBELIAN',
      description: `Pelunasan ke ${po.supplier || 'Supplier'}`,
      amount_in: 0,
      amount_out: Number(po.total_amount || 0),
      workshop_code: po.workshop_code || 'GLOBAL',
      payment_method: paymentMethod || 'KAS GUDANG' // fallback to kas gudang
    })

    if (txError) {
      console.error('Insert Transaksi Error:', txError)
      throw new Error(`Gagal mencatat transaksi pengeluaran: ${txError.message}`)
    }

    // 3. Update status PO jadi LUNAS
    const { error: updateError } = await supabase.from('purchase_orders')
      .update({ status: 'LUNAS', payment_method: paymentMethod })
      .eq('id', id)

    if (updateError) throw new Error('Gagal update status PO.')

    revalidatePath('/dashboard/purchases')
    revalidatePath('/dashboard/report')
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (error) {
    console.error('Pay PO Error:', error)
    return { success: false, error: error.message || 'Terjadi kesalahan saat melunasi PO.' }
  }
}
