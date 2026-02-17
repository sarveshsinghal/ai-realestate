import LogoutButton from '@/components/LogoutButton'

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="flex items-center justify-between p-4 border-b">
        <div className="font-semibold">Agency</div>
        <LogoutButton />
      </header>
      <main>{children}</main>
    </div>
  )
}
