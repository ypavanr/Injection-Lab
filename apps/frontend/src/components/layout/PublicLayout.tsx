import { Outlet, Link } from "react-router-dom"
import { useLocation } from "react-router-dom"
import { useEffect } from "react"

export function PublicLayout() {
  const location = useLocation()

  // VULN: DOM-based XSS - Metadata injection logic migrated from App.tsx
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const searchParams = new URLSearchParams(window.location.search)
    const customTitle = searchParams.get("title")
    const customDesc = searchParams.get("desc")

    if (hash) {
      const banner = document.getElementById("promo-banner")
      if (banner) {
        // VULN: Unsafe DOM sink
        banner.innerHTML = decodeURIComponent(hash)
      }
    }
    if (customTitle) {
      const titleEl = document.getElementById("og-title")
      if (titleEl) titleEl.setAttribute("content", customTitle)
    }
    if (customDesc) {
      const descEl = document.getElementById("og-description")
      if (descEl) descEl.setAttribute("content", customDesc)
    }
  }, [location])

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight">
            The VulnCMS Blog
          </Link>
          <nav className="flex space-x-6 text-sm font-medium">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/admin/dashboard" className="text-primary hover:underline">Admin Login</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-12">
        {/* Hidden promo banner for DOM XSS payload target */}
        <div id="promo-banner" className="empty:hidden mb-8 p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 rounded-md"></div>
        <Outlet />
      </main>

      <footer className="border-t py-8 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} VulnCMS Security Lab. All rights deliberately exposed.
        </div>
      </footer>
    </div>
  )
}
