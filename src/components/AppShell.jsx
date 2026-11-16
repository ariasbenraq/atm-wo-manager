import { App, Page } from 'konsta/react'

export default function AppShell({ title, children }) {
  return (
    <App theme="material" safeAreas={false} className="!h-auto !min-h-0">
      <Page className="!h-auto !overflow-visible !bg-transparent">
        <h2 className="px-4 pb-1 pt-1 text-lg font-bold text-foreground lg:hidden">{title}</h2>
        <div className="px-4 pb-4">{children}</div>
      </Page>
    </App>
  )
}
