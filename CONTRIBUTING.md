# Contributing to VenueFlow

First off, thank you for considering contributing to VenueFlow! It's people like you that make VenueFlow such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps which reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs if possible**
* **Include your environment details** (browser, OS, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and expected behavior**
* **Explain why this enhancement would be useful**

### Pull Requests

* Follow the styleguides (below)
* Include descriptive commit messages
* End all files with a newline
* Reference relevant GitHub issues

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

Example:
```
Add crowd density visualization

- Implement heatmap rendering
- Add zone-based occupancy tracking
- Update UI components

Fixes #123
```

### JavaScript Styleguide

* Use ES6+ features where applicable
* Use `const` by default, `let` when necessary
* Use meaningful variable names
* Add comments for complex logic
* Keep functions small and focused

Example:
```javascript
// Good
const calculateWaitTime = (occupancy) => {
    const baseWaitTime = 2; // minutes
    return Math.round((occupancy / 100) * baseWaitTime * 5);
};

// Avoid
const calcWait = (o) => {
    return Math.round((o / 100) * 2 * 5); // What does this do?
};
```

### HTML/CSS Styleguide

* Use semantic HTML elements
* Use descriptive class names
* Follow BEM (Block Element Modifier) naming for CSS classes
* Keep CSS modular and reusable
* Use CSS variables for colors and spacing

Example:
```html
<!-- Good -->
<section class="dashboard__metrics">
    <div class="metric-card metric-card--active">
        <h3 class="metric-card__title">Total Attendees</h3>
    </div>
</section>

<!-- Avoid -->
<div class="main">
    <div class="big-box red">
        <h3>Total</h3>
    </div>
</div>
```

## Development Setup

### Prerequisites
- Node.js 18+
- Docker Desktop
- Google Cloud CLI

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/venueflow.git
   cd venueflow
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the styleguides
   - Write descriptive commit messages
   - Test your changes locally

4. **Test locally**
   ```bash
   # Using Python HTTP server
   python -m http.server 8080
   
   # Or using Docker
   docker build -t venueflow:test .
   docker run -p 8080:8080 venueflow:test
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "Add your feature description"
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Use a descriptive title
   - Provide clear description of changes
   - Link relevant issues
   - Include screenshots if UI changes

## Project Structure

```
venueflow/
├── index.html           # Main application file
├── styles.css          # Application styling
├── script.js           # Application logic
├── sw.js               # Service Worker
├── Dockerfile          # Docker configuration
├── nginx.conf          # Nginx configuration
├── package.json        # Project metadata
├── README.md           # Project documentation
├── DEPLOYMENT.md       # Deployment guide
└── CONTRIBUTING.md     # This file
```

## Testing

### Manual Testing

1. **Test on multiple browsers**
   - Chrome
   - Firefox
   - Safari
   - Edge

2. **Test on multiple devices**
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

3. **Test functionality**
   - Dashboard updates
   - Queue management
   - Zone analytics
   - Alert system
   - Navigation between views

### Browser DevTools

Use browser DevTools to:
- Check for console errors
- Verify responsive design
- Test network requests
- Monitor performance

## Documentation

- Update README.md for user-facing changes
- Update DEPLOYMENT.md for deployment-related changes
- Add JSDoc comments for functions
- Include examples in documentation

Example JSDoc:
```javascript
/**
 * Calculate wait time based on zone occupancy
 * @param {number} occupancy - Occupancy percentage (0-100)
 * @returns {number} Estimated wait time in minutes
 */
const calculateWaitTime = (occupancy) => {
    const baseWaitTime = 2;
    return Math.round((occupancy / 100) * baseWaitTime * 5);
};
```

## Additional Notes

### Issue and Pull Request Labels

* `bug` - Something isn't working
* `enhancement` - New feature or request
* `documentation` - Improvements or additions to documentation
* `good first issue` - Good for newcomers
* `help wanted` - Extra attention is needed
* `question` - Further information is requested

### Recognition

Contributors will be recognized in:
- The project's CONTRIBUTORS.md file
- GitHub contributor statistics
- Project releases notes

## Questions?

Feel free to:
1. Open an issue with the `question` label
2. Join our community discussions
3. Contact the maintainers directly

---

Thank you for contributing to VenueFlow! 🎉
