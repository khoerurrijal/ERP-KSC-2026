'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'
import { getNormalizedProductHPP } from '@/utils/pricing'

const isValidDateOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export async function createPurchaseOrder(payload) {
  try {
    if (!payload?.poDate || (payload.paymentStatus === 'LUNAS' && !payload.paymentAccount) || !Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 500) {
      return { success: false, error: 'Data purchase order belum lengkap.' }
    }
    if (payload.paymentStatus === 'LUNAS' && !isValidDateOnly(payload.paymentDate)) {
      return { success: false, error: 'Tanggal pelunasan purchase order tidak valid.' }
    }
    if (!['LUNAS', 'TEMPO'].includes(payload.paymentStatus)) {
      return { success: false, error: 'Status pembayaran purchase order tidak valid.' }
    }
    const normalizedItems = payload.items.map(item => ({
      ...item,
      qty: Number(item.qty),
      unit_multiplier: Number(item.unit_multiplier || 1),
      unit_cost: Number(item.unit_cost)
    }))
    if (normalizedItems.some(item => !item.product_id || !Number.isInteger(item.qty) || item.qty <= 0 || !Number.isFinite(item.unit_multiplier) || item.unit_multiplier <= 0 || !Number.isFinite(item.unit_cost) || item.unit_cost < 0)) {
      return { success: false, error: 'Detail item purchase order tidak valid.' }
    }
    const normalizedGrandTotal = normalizedItems.reduce((sum, item) => sum + item.qty * item.unit_multiplier * item.unit_cost, 0)
    if (Math.abs(Number(payload.grandTotal || 0) - normalizedGrandTotal) > 0.01) {
      return { success: false, error: 'Total purchase order tidak sesuai detail item.' }
    }
    payload = { ...payload, items: normalizedItems, grandTotal: normalizedGrandTotal }

    // Dynamically import to avoid circular dependencies if any
    const { updateProductHPPFromReceipt } = await import('@/app/actions/pricing')
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR'], 'Akun Anda tidak memiliki akses pembelian.')

    const receiptByProduct = new Map()
    for (const item of normalizedItems) {
      const receivedQty = item.qty * item.unit_multiplier
      const receipt = receiptByProduct.get(item.product_id) || { receivedQty: 0, receivedValue: 0 }
      receipt.receivedQty += receivedQty
      receipt.receivedValue += receivedQty * item.unit_cost
      receiptByProduct.set(item.product_id, receipt)
    }

    const productCodes = [...receiptByProduct.keys()]
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('product_code, name, category, physical_stock, stock_qty, base_price, price_polos')
      .in('product_code', productCodes)

    if (productsError) return { success: false, error: 'Gagal membaca modal dan stok produk sebelum PO.' }

    const productsByCode = new Map((products || []).map(product => [product.product_code, product]))
    const productCostSnapshots = new Map()
    for (const productCode of productCodes) {
      const product = productsByCode.get(productCode)
      if (!product) return { success: false, error: `Produk ${productCode} tidak ditemukan.` }

      const category = String(product.category || '').toLowerCase()
      const isNonStock = category.includes('jasa') || category.includes('printing')
      if (isNonStock) continue

      const stockValue = product.physical_stock ?? product.stock_qty ?? 0
      const currentStockQty = Number(stockValue)
      if (!Number.isFinite(currentStockQty)) {
        return { success: false, error: `Stok fisik ${product.name} tidak valid, PO belum disimpan.` }
      }

      productCostSnapshots.set(productCode, {
        currentStockQty: Math.max(0, currentStockQty),
        currentHPP: getNormalizedProductHPP(product),
        previousPricePolos: product.price_polos
      })
    }

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
        supplier: payload.supplierId,
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
      .insert(itemsToInsert, { defaultToNull: false })

    if (itemsError) {
      console.error('Items Insert Error:', itemsError)
      // Cleanup PO if items fail
      await supabase.from('purchase_orders').delete().eq('id', po.id)
      return { success: false, error: itemsError.message }
    }

    // 5. Inventory is updated automatically by DB Trigger on purchase_items

    // 5.5. Insert transaction log if payment status is LUNAS
    if (payload.paymentStatus === 'LUNAS') {
      const { error: txError } = await supabase.from('transactions').insert({
        date: payload.paymentDate,
        reference: 'PEMBELIAN',
        description: `Pembayaran Lunas ke ${payload.supplierId || 'Supplier'}`,
        amount_in: 0,
        amount_out: Number(payload.grandTotal || 0),
        workshop_code: payload.items[0]?.workshop_code || 'GLOBAL',
        payment_method: payload.paymentAccount || 'CASH',
        po_id: po.id
      })

      if (txError) {
        console.error('PO Transaction Insert Error:', txError)
        // Cleanup PO if transaction log fails to maintain consistency
        await supabase.from('purchase_orders').delete().eq('id', po.id)
        return { success: false, error: 'Gagal mencatat transaksi kas: ' + txError.message }
      }
    }

    // 6. Update modal master from this newly received PO. Manual normalization in
    // the product master becomes the starting cost for the next receipt.
    const updatedProductCosts = []
    for (const [productCode, receipt] of receiptByProduct) {
      const snapshot = productCostSnapshots.get(productCode)
      if (!snapshot) continue

      const hppUpdate = await updateProductHPPFromReceipt(productCode, {
        ...snapshot,
        ...receipt
      })

      if (!hppUpdate.success) {
        const restoreErrors = []
        for (const updatedCost of updatedProductCosts) {
          const { error: restoreError } = await supabase
            .from('products')
            .update({ price_polos: updatedCost.previousPricePolos })
            .eq('product_code', updatedCost.productCode)
          if (restoreError) restoreErrors.push(restoreError.message)
        }
        await supabase.from('transactions').delete().eq('po_id', po.id)
        const { error: rollbackError } = await supabase.from('purchase_orders').delete().eq('id', po.id)
        if (rollbackError || restoreErrors.length > 0) {
          const rollbackDetails = [rollbackError?.message, ...restoreErrors].filter(Boolean).join('; ')
          return { success: false, error: `PO tersimpan, tetapi pemulihan otomatis gagal: ${hppUpdate.error || rollbackDetails}` }
        }
        return { success: false, error: `PO dibatalkan karena HPP master gagal diperbarui: ${hppUpdate.error || 'kesalahan tidak diketahui'}` }
      }

      updatedProductCosts.push({ productCode, previousPricePolos: snapshot.previousPricePolos })
    }

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/purchases')
    revalidatePath('/dashboard/master/products')
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
    // Historical PO edits change stock through the existing trigger. They do not
    // overwrite the normalized current HPP from an incomplete PO history.
    if (payload?.paymentStatus === 'LUNAS' && !isValidDateOnly(payload.paymentDate)) {
      return { success: false, error: 'Tanggal pelunasan purchase order tidak valid.' }
    }
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR'], 'Akun Anda tidak memiliki akses pembelian.')

    const { data: poInfo } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .eq('id', id)
      .single()
    const poNumber = poInfo?.po_number || 'PO'

    // 1. Stock reverting is automatically handled by DB Trigger on purchase_items BEFORE DELETE

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
        supplier: payload.supplierId,
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

    const { error: itemsError } = await supabase.from('purchase_items').upsert(itemsToInsert, { defaultToNull: false })
    if (itemsError) throw new Error(itemsError.message)

    // 5. Inventory is updated automatically by DB Trigger on purchase_items

    // 5.5. Synchronize cash transaction ledger depending on paymentStatus
    if (payload.paymentStatus === 'LUNAS') {
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('po_id', id)
        .eq('reference', 'PEMBELIAN')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingTx) {
        const { error: txUpdateError } = await supabase
          .from('transactions')
          .update({
            date: payload.paymentDate,
            amount_out: Number(payload.grandTotal || 0),
            payment_method: payload.paymentAccount,
            workshop_code: payload.items[0]?.workshop_code || 'GLOBAL',
            description: `Pembayaran Lunas ke ${payload.supplierId || 'Supplier'}`
          })
          .eq('id', existingTx.id)
        if (txUpdateError) throw txUpdateError
      } else {
        const { error: txInsertError } = await supabase
          .from('transactions')
          .insert({
            date: payload.paymentDate,
            reference: 'PEMBELIAN',
            description: `Pembayaran Lunas ke ${payload.supplierId || 'Supplier'}`,
            amount_in: 0,
            amount_out: Number(payload.grandTotal || 0),
            workshop_code: payload.items[0]?.workshop_code || 'GLOBAL',
            payment_method: payload.paymentAccount || 'CASH',
            po_id: id
          })
        if (txInsertError) throw txInsertError
      }
    } else if (payload.paymentStatus === 'TEMPO') {
      await supabase
        .from('transactions')
        .delete()
        .eq('po_id', id)
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
    // Keep the current normalized HPP; deleting a historical receipt does not
    // reconstruct costs already issued to prior orders.
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR'], 'Akun Anda tidak memiliki akses pembelian.')

    // 1. Ambil PO sebelum dihapus untuk rollback cash dan pricing
    const { data: po, error: poFetchErr } = await supabase
      .from('purchase_orders')
      .select('id, po_number, status, workshop_code')
      .eq('id', id)
      .single()
    if (poFetchErr || !po) throw new Error('PO tidak ditemukan.')

    // 2. Rollback cash OUT jika PO pernah LUNAS
    // Gunakan exact po_id FK — bukan LIKE description
    if (po.status === 'LUNAS') {
      await supabase
        .from('transactions')
        .delete()
        .eq('po_id', id)
    }

    // 3. Hapus PO (items CASCADE via FK)
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (error) throw new Error(error.message)

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

export async function getPurchaseOrderPaymentDate(id) {
  try {
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR'], 'Akun Anda tidak memiliki akses pembelian.')
    const { data, error } = await supabase
      .from('transactions')
      .select('date')
      .eq('po_id', id)
      .eq('reference', 'PEMBELIAN')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return { success: true, paymentDate: data?.date || null }
  } catch (error) {
    console.error('Get PO Payment Date Error:', error)
    return { success: false, error: error.message || 'Gagal memuat tanggal pelunasan PO.' }
  }
}

export async function payPurchaseOrder(id, paymentMethod, paymentDate) {
  try {
    if (!isValidDateOnly(paymentDate)) throw new Error('Tanggal pelunasan tidak valid.')
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR'], 'Akun Anda tidak memiliki akses pembelian.')

    // 1. Ambil data PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, status, total_amount, supplier, workshop_code')
      .eq('id', id)
      .single()
    if (poError || !po) throw new Error('Data PO tidak ditemukan.')

    // Guard 1: PO sudah lunas
    if (po.status === 'LUNAS') throw new Error('PO sudah lunas. Tidak bisa membayar ulang.')

    // Guard 2: Duplicate cash transaction — cek exact po_id FK
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('po_id', po.id)
      .eq('reference', 'PEMBELIAN')
      .limit(1)
    if (existingTx && existingTx.length > 0) {
      throw new Error('Transaksi pembayaran untuk PO ini sudah pernah dicatat. Hubungi admin jika perlu koreksi.')
    }

    // 2. Insert tepat 1 transaksi amount_out sebesar total PO penuh
    const { data: paymentTransaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        date: paymentDate,
        reference: 'PEMBELIAN',
        description: `Pembayaran Lunas ke ${po.supplier || 'Supplier'}`,
        amount_in: 0,
        amount_out: Number(po.total_amount || 0),
        workshop_code: po.workshop_code || 'GLOBAL',
        payment_method: paymentMethod || 'KAS GUDANG',
        po_id: po.id
      })
      .select('id')
      .single()

    if (txError) throw new Error(`Gagal mencatat transaksi pengeluaran: ${txError.message}`)

    // 3. Update status PO jadi LUNAS
    const { error: updateError } = await supabase.from('purchase_orders')
      .update({ status: 'LUNAS', payment_method: paymentMethod })
      .eq('id', id)

    if (updateError) {
      const { error: cleanupError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', paymentTransaction.id)
      if (cleanupError) console.error('PO Payment Rollback Error:', cleanupError)
      throw new Error(cleanupError
        ? `Gagal update status PO dan membatalkan transaksi pelunasan: ${cleanupError.message}`
        : 'Gagal update status PO.')
    }

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
