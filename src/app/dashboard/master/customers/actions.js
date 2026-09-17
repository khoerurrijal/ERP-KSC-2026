'use server'

import { randomUUID } from 'node:crypto'
import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

async function getCustomerAdminClient() {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  return supabase
}

function mapCustomer(customer) {
  return customer ? { ...customer, city: customer.address || '' } : customer
}

function generateCustomerCode() {
  return `CUST-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
}

function getCustomerPayload(data = {}, includeCode = false) {
  const address = data.city !== undefined ? data.city : data.address
  const payload = {
    name: String(data.name || '').trim(),
    type: data.type ? String(data.type).trim() : null,
    phone: data.phone ? String(data.phone).trim() : null,
    address: address ? String(address).trim() : ''
  }

  if (includeCode) payload.customer_code = generateCustomerCode()
  return payload
}

export async function addCustomer(data = {}) {
  try {
    const payload = getCustomerPayload(data, true)
    if (!payload.name) return { error: 'Nama pelanggan wajib diisi.' }

    const supabase = await getCustomerAdminClient()
    const { data: customer, error } = await supabase
      .from('customers')
      .insert([payload])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return { error: 'Kode pelanggan bentrok. Silakan coba simpan lagi.' }
      return { error: error.message }
    }

    revalidatePath('/dashboard/master/customers')
    return { success: true, customer: mapCustomer(customer) }
  } catch (error) {
    return { error: error.message || 'Gagal menambahkan pelanggan.' }
  }
}

export async function deleteCustomer(id) {
  try {
    const supabase = await getCustomerAdminClient()
    const { error } = await supabase.from('customers').delete().eq('id', id)

    if (error) {
      if (error.code === '23503') return { error: 'Gagal dihapus: Pelanggan ini sudah memiliki transaksi.' }
      return { error: error.message }
    }

    revalidatePath('/dashboard/master/customers')
    return { success: true }
  } catch (error) {
    return { error: error.message || 'Gagal menghapus pelanggan.' }
  }
}

export async function updateCustomer(id, data = {}) {
  try {
    const payload = getCustomerPayload(data)
    if (!payload.name) return { error: 'Nama pelanggan wajib diisi.' }

    const supabase = await getCustomerAdminClient()
    const { data: customer, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) return { error: error.code === 'PGRST116' ? 'Pelanggan tidak ditemukan.' : error.message }

    revalidatePath('/dashboard/master/customers')
    return { success: true, customer: mapCustomer(customer) }
  } catch (error) {
    return { error: error.message || 'Gagal memperbarui pelanggan.' }
  }
}
