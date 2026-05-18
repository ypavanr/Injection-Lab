# Web Application Navigation Structure (VulnCMS)

This document provides a complete graphical web structure of the VulnCMS frontend application. It contains a visual flowchart, a formal adjacency list representing the page connections, and a detailed breakdown of every hyperlink, button, and redirect that connects the pages.

---

## Part 1: Visual Navigation Flow

The following Mermaid diagram shows the visual flow of pages in the VulnCMS application, including public facing routes, admin areas, and external integration links.

```mermaid
flowchart TD
    %% Public Pages
    Home["Home (/)"]
    PostView["Post View (/post/:id)"]
    Search["Search (/search)"]
    AuthorPage["Author Page (/author/:id)"]
    
    %% Auth Pages
    Login["Login (/admin/login)"]
    
    %% Admin Pages (Sidebar available on all)
    Dashboard["Admin Dashboard (/admin/dashboard)"]
    PostsList["Posts List (/admin/posts)"]
    PostEditorNew["Post Editor - New (/admin/editor)"]
    PostEditorEdit["Post Editor - Edit (/admin/editor/:id)"]
    MediaLibrary["Media Library (/admin/media)"]
    CommentsModeration["Comments Moderation (/admin/comments)"]
    UsersList["Users List (/admin/users)"]
    Settings["Settings (/admin/settings)"]
    
    %% External / API links
    RSS["RSS Feed (/api/content/rss.xml)"]
    Sitemap["Sitemap (/api/content/sitemap.xml)"]
    TrainingData["Training Data Export (/api/content/export/training.jsonl)"]
    KG["Knowledge Graph API (/api/ai/graph)"]
    ExtLink["External Links (User/Comment websites)"]

    %% Public Navigations
    Home -->|Click Post Card| PostView
    Home -->|Click Author Name| AuthorPage
    Home -->|Click RSS Feed link| RSS
    Home -->|Click Sitemap link| Sitemap
    Home -->|Click Search link| Search
    Home -->|Click Admin Login| Dashboard
    Home -->|Empty state - Create one link| PostEditorNew
    
    PostView -->|Click Author Name| AuthorPage
    PostView -->|Click Guest Website| ExtLink
    PostView -->|Header Logo/Home link| Home
    PostView -->|Header Admin Login| Dashboard
    
    Search -->|Click Result Card| PostView
    Search -->|Header Logo/Home link| Home
    Search -->|Header Admin Login| Dashboard
    
    AuthorPage -->|Click Post Card| PostView
    AuthorPage -->|Click Website Link| ExtLink
    AuthorPage -->|Header Logo/Home link| Home
    AuthorPage -->|Header Admin Login| Dashboard
    
    %% Auth / Redirects
    Login -->|Back link| Home
    Login -->|Submit Form (Success)| Dashboard
    Dashboard -.->|Not Logged In Redirect| Login
    
    %% Admin Sidebar Navigations (Shared by all Admin pages)
    subgraph Admin Area
        Dashboard
        PostsList
        PostEditorNew
        PostEditorEdit
        MediaLibrary
        CommentsModeration
        UsersList
        Settings
    end
    
    %% Dashboard Specific Actions
    Dashboard -->|Click Total Posts Card| PostsList
    Dashboard -->|Click Total Users Card| UsersList
    Dashboard -->|Click Pending Comments Card| CommentsModeration
    Dashboard -->|Click Security Alerts Card| Settings
    Dashboard -->|Click Recent Post title| PostEditorEdit
    
    %% Posts List Specific Actions
    PostsList -->|Click New Post Button| PostEditorNew
    PostsList -->|Click Edit Icon| PostEditorEdit
    PostsList -->|Click View Icon| PostView
    PostsList -->|Empty list placeholder link| PostEditorNew
    
    %% Post Editor Specific Actions
    PostEditorNew -->|Save Draft / Publish (Success)| PostEditorEdit
    
    %% Comments Moderation Specific Actions
    CommentsModeration -->|Click Commenter URL| ExtLink
    
    %% Users List Specific Actions
    UsersList -->|Click User Website URL| ExtLink
    
    %% Sidebar Global Actions (from any admin page)
    Admin Area -->|Sidebar: Dashboard| Dashboard
    Admin Area -->|Sidebar: Posts| PostsList
    Admin Area -->|Sidebar: Media| MediaLibrary
    Admin Area -->|Sidebar: Comments| CommentsModeration
    Admin Area -->|Sidebar: Users| UsersList
    Admin Area -->|Sidebar: Settings| Settings
    Admin Area -->|Sidebar: View Site| Home
    Admin Area -->|Sidebar: Logout| Login
    Admin Area -->|Sidebar: Export Training Data| TrainingData
    Admin Area -->|Sidebar: Knowledge Graph| KG
```

---

## Part 2: Web Structure Adjacency List

Below is the formal adjacency list mapping each page (node) to all the target pages it links to, along with the UI element responsible for the connection.

### 1. Public Blog Home (`/`)
* **Connected Pages:**
  1. `Home (/)` (Self-loop) via:
     - **Header Logo Brand Link:** `<Link to="/" className="text-xl font-bold ...">The VulnCMS Blog</Link>`
     - **Header Home Menu Link:** `<Link to="/" className="text-muted-foreground ...">Home</Link>`
  2. `Admin Dashboard (/admin/dashboard)` via:
     - **Header Admin Login Link:** `<Link to="/admin/dashboard" className="text-primary hover:underline">Admin Login</Link>` *(Note: Redirects to `/admin/login` if not authenticated).*
  3. `Search (/search)` via:
     - **Hero Quick Link:** `<Link to="/search" className="hover:underline">Search</Link>`
  4. `Post View (/post/:id)` via:
     - **Post Grid Cards:** `<Link to={/post/\${post.id}} key={post.id} className="group">`
  5. `Author Page (/author/:id)` via:
     - **Author Meta Link (inside Post Card):** `<Link to={/author/\${post.author.id}} className="hover:underline" onClick={...}>`
  6. `Post Editor - New (/admin/editor)` via:
     - **Create Post link (empty state fallback):** `<Link to="/admin/editor" className="underline">Create one</Link>`
  7. *[External API]* `RSS Feed (/api/content/rss.xml)` via:
     - **Hero Quick Link:** `<a href="/api/content/rss.xml" className="hover:underline">RSS Feed</a>`
  8. *[External API]* `Sitemap (/api/content/sitemap.xml)` via:
     - **Hero Quick Link:** `<a href="/api/content/sitemap.xml" className="hover:underline">Sitemap</a>`

### 2. Public Post View (`/post/:id`)
* **Connected Pages:**
  1. `Home (/)` via:
     - **Header Logo Brand Link:** `<Link to="/">The VulnCMS Blog</Link>`
     - **Header Home Menu Link:** `<Link to="/">Home</Link>`
  2. `Admin Dashboard (/admin/dashboard)` via:
     - **Header Admin Login Link:** `<Link to="/admin/dashboard">Admin Login</Link>` *(Note: Redirects to `/admin/login` if not authenticated).*
  3. `Author Page (/author/:id)` via:
     - **Author Meta Link (Post Header):** `<Link to={/author/\${post.author.id}} className="hover:underline font-medium">`
  4. *[External]* `Commenter Website Link` via:
     - **Commenter Name Link (in Comments list):** `<a href={comment.guestUrl} className="font-semibold hover:underline">` *(Note: Dynamic target URL based on comment metadata).*

### 3. Public Search (`/search`)
* **Connected Pages:**
  1. `Home (/)` via:
     - **Header Logo Brand Link:** `<Link to="/">The VulnCMS Blog</Link>`
     - **Header Home Menu Link:** `<Link to="/">Home</Link>`
  2. `Admin Dashboard (/admin/dashboard)` via:
     - **Header Admin Login Link:** `<Link to="/admin/dashboard">Admin Login</Link>` *(Note: Redirects to `/admin/login` if not authenticated).*
  3. `Post View (/post/:id)` via:
     - **Search Result Cards:** `<Link to={/post/\${post.id}} key={post.id}>`

### 4. Public Author Profile Page (`/author/:id`)
* **Connected Pages:**
  1. `Home (/)` via:
     - **Header Logo Brand Link:** `<Link to="/">The VulnCMS Blog</Link>`
     - **Header Home Menu Link:** `<Link to="/">Home</Link>`
  2. `Admin Dashboard (/admin/dashboard)` via:
     - **Header Admin Login Link:** `<Link to="/admin/dashboard">Admin Login</Link>` *(Note: Redirects to `/admin/login` if not authenticated).*
  3. `Post View (/post/:id)` via:
     - **Author's Post Grid Cards:** `<Link to={/post/\${post.id}} key={post.id}>`
  4. *[External]* `Author Personal Website` via:
     - **Profile Website Link:** `<a href={author.website} className="..." target="_blank">` *(Note: Dynamic target based on author's profile website).*

### 5. Login Page (`/admin/login`)
* **Connected Pages:**
  1. `Home (/)` via:
     - **Footer Link:** `<Link to="/" className="hover:underline">← Back to blog</Link>`
  2. `Admin Dashboard (/admin/dashboard)` via:
     - **Form Submission Success:** Redirects dynamically via `navigate('/admin/dashboard')` inside the `handleSubmit` event handler.

---

### Shared Admin Sidebar (Displayed on all pages under `/admin/*`)
Every page inside the `/admin/*` workspace shares a sidebar component (`Sidebar.tsx`) which acts as a global navigation hub.

* **Sidebar Navigations:**
  1. `Admin Dashboard (/admin/dashboard)` via:
     - **Dashboard Nav Link:** `<NavLink to="/admin/dashboard">Dashboard</NavLink>`
  2. `Posts List (/admin/posts)` via:
     - **Posts Nav Link:** `<NavLink to="/admin/posts">Posts</NavLink>`
  3. `Media Library (/admin/media)` via:
     - **Media Nav Link:** `<NavLink to="/admin/media">Media</NavLink>`
  4. `Comments Moderation (/admin/comments)` via:
     - **Comments Nav Link:** `<NavLink to="/admin/comments">Comments</NavLink>`
  5. `Users List (/admin/users)` via:
     - **Users Nav Link:** `<NavLink to="/admin/users">Users</NavLink>`
  6. `Settings (/admin/settings)` via:
     - **Settings Nav Link:** `<NavLink to="/admin/settings">Settings</NavLink>`
  7. `Home (/)` via:
     - **View Site Link:** `<NavLink to="/">View Site</NavLink>`
  8. `Login (/admin/login)` via:
     - **Logout Button:** Clicking `<Button onClick={handleLogout}>` clears local tokens and triggers `navigate('/admin/login')`.
  9. *[External API]* `Training Data Export (/api/content/export/training.jsonl)` via:
     - **Export Link:** `<a href="/api/content/export/training.jsonl" target="_blank">Export Training Data</a>`
  10. *[External API]* `Knowledge Graph API (/api/ai/graph)` via:
     - **Graph Link:** `<a href="/api/ai/graph" target="_blank">Knowledge Graph</a>`

---

### 6. Admin Dashboard (`/admin/dashboard`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - **Page-specific Connections:**
    1. `Posts List (/admin/posts)` via:
       - **Total Posts Stat Card:** `<Link to="/admin/posts">`
    2. `Users List (/admin/users)` via:
       - **Total Users Stat Card:** `<Link to="/admin/users">`
    3. `Comments Moderation (/admin/comments)` via:
       - **Pending Comments Stat Card:** `<Link to="/admin/comments">`
    4. `Settings (/admin/settings)` via:
       - **Security Alerts Card:** `<Link to="/admin/settings">`
    5. `Post Editor - Edit (/admin/editor/:id)` via:
       - **Recent Posts List Items:** `<Link to={/admin/editor/\${p.id}} className="font-medium hover:underline truncate block">`

### 7. Posts List (`/admin/posts`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - **Page-specific Connections:**
    1. `Post Editor - New (/admin/editor)` via:
       - **Header Button:** `<Link to="/admin/editor"><Plus ... /> New Post</Link>`
       - **No Posts Table Fallback:** `<Link to="/admin/editor" className="underline">Create one</Link>`
    2. `Post Editor - Edit (/admin/editor/:id)` via:
       - **Actions Column - Edit Button:** `<Link to={/admin/editor/\${post.id}}><Edit ... /></Link>`
    3. `Post View (/post/:id)` via:
       - **Actions Column - External View Button:** `<Link to={/post/\${post.id}} target="_blank"><ExternalLink ... /></Link>`

### 8. Post Editor — New (`/admin/editor`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - **Page-specific Connections:**
    1. `Post Editor - Edit (/admin/editor/:id)` via:
       - **First Save/Publish Action:** Submitting a brand new post triggers `navigate(/admin/editor/\${res.data.id})` upon successful backend creation.

### 9. Post Editor — Edit (`/admin/editor/:id`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - No page-specific connections. Save and publish operations update the current resource state locally without redirection.

### 10. Media Library (`/admin/media`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - No page-to-page connections. All elements are media resource management triggers.

### 11. Comments Moderation (`/admin/comments`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - **Page-specific Connections:**
    1. *[External]* `Commenter Website Link` via:
       - **Table URL Cell Link:** `<a href={c.guestUrl} className="hover:underline" target="_blank">` *(Note: Dynamic target URL based on comment website metadata).*

### 12. Users List (`/admin/users`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - **Page-specific Connections:**
    1. *[External]* `User Website Link` via:
       - **Table Website Cell Link:** `<a href={u.website} className="hover:underline" target="_blank">` *(Note: Dynamic target URL based on user's profile website metadata).*

### 13. Settings (`/admin/settings`)
* **Connected Pages:**
  - *Plus all Shared Admin Sidebar routes*
  - No page-specific connections. All items configure local theme settings or display logs information.

---

## Part 3: Router Page Definitions

Below is a reference guide mapping the route patterns in React Router (`App.tsx`) to their rendering component and authentication constraints.

| Route Path | Component Name | Layout Context | Authentication / Role Check |
|---|---|---|---|
| `/` | `Home` | `PublicLayout` | Public (Unauthenticated) |
| `/post/:id` | `PostView` | `PublicLayout` | Public (Unauthenticated) |
| `/search` | `Search` | `PublicLayout` | Public (Unauthenticated) |
| `/author/:id` | `AuthorPage` | `PublicLayout` | Public (Unauthenticated) |
| `/admin/login` | `Login` | None | Public (Unauthenticated) |
| `/admin` | `Navigate` (Redirect) | `AdminLayout` | Redirects directly to `/admin/dashboard` |
| `/admin/dashboard` | `Dashboard` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `/admin/posts` | `PostsList` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `/admin/editor` | `PostEditor` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `/admin/editor/:id` | `PostEditor` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `/admin/media` | `MediaLibrary` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `/admin/comments` | `CommentsModeration` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `/admin/users` | `UsersList` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `/admin/settings` | `Settings` | `AdminLayout` | Protected *(Redirects to `/admin/login` if `user` is null)* |
| `*` | `Navigate` (Redirect) | None | Wildcard catch-all - redirects back to `/` |
