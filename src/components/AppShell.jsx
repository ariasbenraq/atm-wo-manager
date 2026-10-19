import { App, Page, Navbar } from 'konsta/react'

export default function AppShell({ title, children }) {
  return (
    <App theme="material" safeAreas={false}>
      <Page>
        <Navbar
          title={title}
          bgClassName="bg-md-light-surface dark:bg-md-dark-surface"
        />
        <div className="px-4 pb-24">{children}</div>
      </Page>
    </App>
  )
}
