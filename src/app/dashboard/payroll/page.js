import { getPayrollInitialPageData } from './readData'
import PayrollClient from './PayrollClient'

export const metadata = {
  title: 'Absen & Gaji | King Sablon',
}

export default async function PayrollPage() {
  const { dropdownConfig, initialAttendance, initialSavedPayrolls } = await getPayrollInitialPageData()

  return (
    <PayrollClient
      dropdownConfig={dropdownConfig}
      initialAttendance={initialAttendance}
      initialSavedPayrolls={initialSavedPayrolls}
    />
  )
}
