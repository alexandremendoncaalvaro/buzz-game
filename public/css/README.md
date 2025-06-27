# CSS Architecture

## Structure

The CSS is now organized in a modular fashion following the principles of separation of concerns:

### Files Overview

- **`base.css`** - CSS variables, global reset, base layout, and typography
- **`components.css`** - Reusable UI components (buttons, cards, inputs, etc.)
- **`player.css`** - Player-specific styles (index.html)
- **`creator.css`** - Game creator-specific styles (create.html)  
- **`admin.css`** - Admin panel-specific styles (admin.html)

### Usage Pattern

Each HTML page imports only the CSS it needs:

```html
<!-- Player page (index.html) -->
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/player.css">

<!-- Creator page (create.html) -->
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/creator.css">

<!-- Admin page (admin.html) -->
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/admin.css">
```

## Benefits

1. **Separation of Concerns** - Each file has a specific responsibility
2. **Maintainability** - Easier to find and modify styles
3. **Performance** - Only load necessary CSS for each page
4. **Scalability** - Easy to add new page-specific styles
5. **Reusability** - Components can be shared across pages

## Design System

All colors, spacing, and other design tokens are centralized in `base.css` using CSS custom properties (variables), ensuring consistency across the application.
