# Jellyfin Custom Background Trailers

A Jellyfin plugin that automatically plays movie/show trailers in the background on detail pages, with smooth logo animations and customizable backdrop effects for an immersive viewing experience.

## 🎬 Context

This plugin enhances the Jellyfin user interface by automatically playing local trailers as background videos when viewing movie or show details. It creates a cinematic experience similar to streaming platforms, with smooth animations, customizable effects, and an optional sound control button.

## ✨ Features

- **Automatic Trailer Playback**: Automatically plays local trailers in the background when viewing item details
- **Smooth Logo Animation**: Progressively shrinks and fades the logo with configurable timing and opacity
- **Backdrop Fade Effect**: Smoothly transitions the backdrop to transparent while the trailer plays
- **Sound Control Button**: Optional floating button with customizable pulse animation to toggle trailer audio
- **Highly Configurable**: Extensive options to customize timings, animations, colors, and effects
- **Seamless Transitions**: Reliable animations that work consistently across navigation
- **Lightweight**: All-in-one JavaScript solution with no external CSS files required

## 📋 Prerequisites

- Jellyfin server with web interface access
- **JS Injector Plugin** installed and configured ([GitHub](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector))
- Local trailers added to your media items

## 🚀 Installation

### Setup Instructions

**0. Install Prerequisites**
   - Install the JS Injector plugin from the Jellyfin plugin catalog
   - Configure it in your Jellyfin admin dashboard

**1. Add a New Script**
   - Go to Jellyfin Dashboard → Plugins → JS Injector
   - Click "Add New Script"

**2. Copy and Paste the Code**
   - Copy the **configuration template** below and paste it into the new script
   - Adjust the parameters to your preferences (see Configuration section below for details)

```javascript
// ===== OPTIONS =====
window.BTPluginOptions = {
    // Audio Options
    trailerMutedByDefault: true,      // Start trailers muted
    showSoundButton: true,            // Show floating sound control button

    // Sound Button Options
    enablePulseOnButton: true,        // Enable pulse animation on the button
    pulseColor: 'rgba(0,150,255,0.7)',// Pulse glow color

    // Logo Animation Options
    logoScale: 0.6,                   // Final logo size (0.6 = 60% of original)
    logoShrinkDelay: 500,             // Delay before shrinking (ms)
    logoShrinkDuration: 1000,         // Shrink animation duration (ms)
    logoFadeOpacity: 0.5,             // Final logo opacity (0-1)

    // Backdrop Animation Options
    backdropTransition: 1000,         // General transition duration (ms)
    backdropFadeDelay: 1500,          // Delay before backdrop fades (ms)
    backdropFadeDuration: 2000,       // Fade animation duration (ms)
    backdropZoomScale: 1.80,          // Backdrop zoom level (1.80 = 180%)

    // Global Delay
    globalDelay: 1200,                // Global delay before activation (ms)
    enableGlobalDelay: true           // Enable/disable global delay
};

// ========== LOAD PLUGIN ==========
const script = document.createElement("script");
script.src = `https://cdn.jsdelivr.net/gh/GhislainSamy/jellyfin-custom-background-trailers@main/custom-background-trailers.js`;
script.async = true;
document.head.appendChild(script);
```

**3. Save Your Changes**
   - Click "Save" and refresh your Jellyfin web interface
   - Navigate to any movie/show detail page to see the plugin in action

### Screenshot

<img width="655" height="844" alt="{42A94ED9-C7EC-44D6-9D23-BA8E0933946D}" src="https://github.com/user-attachments/assets/a479d6bc-a0e6-4eb1-967e-0ff6fb002ba1" />

**4. Install custom css**

- Navigate to Dashboard Settings
1. Log in as an administrator.  
2. Go to **Dashboard → General → Custom CSS Code**.

- Add Import Statements
In the **Custom CSS** field, add all the desired `@import` statements:

```
@import url("https://cdn.jsdelivr.net/gh/GhislainSamy/jellyfin-custom-background-trailers@main/enhanced-backdrop-trailer.css");
```

Include this import statements if you are using the Jellyfish theme :

```
@import url("https://cdn.jsdelivr.net/gh/GhislainSamy/jellyfin-custom-background-trailers@main/jellyfish-personnal-fix.css");
```

---

## ⚙️ Configuration

### Audio Options

| Parameter               | Type    | Default | Description                                 |
| ----------------------- | ------- | ------- | ------------------------------------------- |
| `trailerMutedByDefault` | boolean | `true`  | Whether trailers start muted by default     |
| `showSoundButton`       | boolean | `true`  | Show/hide the floating sound control button |

### Sound Button Options

| Parameter             | Type    | Default                 | Description                                                    |
| --------------------- | ------- | ----------------------- | -------------------------------------------------------------- |
| `enablePulseOnButton` | boolean | `true`                  | Enable pulse animation when sound button appears               |
| `pulseColor`          | string  | `'rgba(0,150,255,0.7)'` | Color of the pulse glow effect (supports any CSS color format) |

### Logo Animation Options

| Parameter            | Type   | Default | Description                                                                   |
| -------------------- | ------ | ------- | ----------------------------------------------------------------------------- |
| `logoScale`          | number | `0.6`   | Final size of the logo after shrinking (1 = 100%, 0.6 = 60% of original size) |
| `logoShrinkDelay`    | number | `500`   | Delay before logo starts shrinking (in milliseconds)                          |
| `logoShrinkDuration` | number | `1000`  | Duration of the logo shrink animation (in milliseconds)                       |
| `logoFadeOpacity`    | number | `0.5`   | Final opacity of the logo after animation (0 = invisible, 1 = fully opaque)   |

### Backdrop Animation Options

| Parameter              | Type   | Default | Description                                               |
| ---------------------- | ------ | ------- | --------------------------------------------------------- |
| `backdropFadeDelay`    | number | `1500`  | Delay before backdrop starts fading (in milliseconds)     |
| `backdropFadeDuration` | number | `2000`  | Duration of the backdrop fade animation (in milliseconds) |
| `backdropZoomScale`    | number | `1.80`  | Zoom level of backdrop during fade (1.8 = 180%)           |
| `backdropTransition`   | number | `1000`  | General backdrop transition duration (in milliseconds)    |

### Global Delay Options

| Parameter           | Type    | Default | Description                                                  |
| ------------------- | ------- | ------- | ------------------------------------------------------------ |
| `globalDelay`       | number  | `1200`  | Global delay before trailer activation (in milliseconds)     |
| `enableGlobalDelay` | boolean | `false` | Enable or disable the global delay before starting a trailer |

### Example Configurations

**Slow and Cinematic:**

```javascript
const options = {
    logoShrinkDelay: 1000,
    logoShrinkDuration: 2000,
    logoFadeOpacity: 0.3,
    backdropFadeDelay: 1000,
    backdropFadeDuration: 2000,
    pulseColor: 'rgba(138,43,226,0.7)' // Purple glow
};
```

**Fast and Subtle:**

```javascript
const options = {
    logoShrinkDelay: 200,
    logoShrinkDuration: 500,
    logoFadeOpacity: 0.7,
    backdropFadeDelay: 200,
    backdropFadeDuration: 500,
    backdropZoomScale: 1.05
};
```

**No Logo Fade, Dramatic Backdrop:**

```javascript
const options = {
    logoFadeOpacity: 1, // Logo stays fully visible
    backdropFadeDelay: 0,
    backdropFadeDuration: 1500,
    backdropZoomScale: 1.3,
    pulseColor: 'rgba(255,0,0,0.7)' // Red glow
};
```

---

## 🎨 Demo

### Web
https://github.com/user-attachments/assets/21945a8f-582a-4016-b090-6468d0a8d6e0

### Mobile
https://github.com/user-attachments/assets/522c35e1-c355-4458-843b-82b84f1a470b

### What You'll See:

1. Navigate to a movie or show detail page
2. The trailer automatically loads and plays in the background
3. The logo smoothly shrinks and fades to the corner
4. The backdrop gradually fades to reveal the trailer playing in the background
5. A sound control button appears (if enabled) with a pulse effect
6. Click the button to toggle trailer audio on/off

---

## 🐛 Troubleshooting

### Trailer Doesn't Play
- Ensure you have local trailers added to your media items
- Check browser console for error messages
- Verify JS Injector plugin is active

### Animations Don't Work
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh the page (Ctrl+F5)
- Check that no other custom CSS is interfering

### Sound Button Not Appearing
- Verify `showSoundButton: true` in options
- Check browser console for errors
- Ensure the trailer video element loaded successfully

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs by opening an issue
- Suggest new features
- Submit pull requests with improvements

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🙏 Credits

Created by [GhislainSamy](https://github.com/GhislainSamy)

Special thanks to the Jellyfin community for their support and feedback.

---

## 📝 Changelog

### v1.1.0
- **Sound button fixes:** removed unnecessary `!important` declarations, ensuring proper styling.
- **Corrected default parameters:** plugin options now reflect intended default behavior.
- **Backdrop animation improvements:** smooth fade transitions implemented, previous abrupt zoom removed.
- **Global delay option added:** configurable delay before trailer activation (`globalDelay` and `enableGlobalDelay`).
- **CSS file separation:** split into `jellyfin-personal-fix.css` and `enhanced-backdrop-trailer.css` for easier customization.
- **Mobile demo video added:** included a demo video showing plugin behavior on mobile devices.


### v1.0.0
- Initial release
- Automatic background trailer playback
- Configurable logo shrink and fade animations
- Configurable backdrop fade with zoom effect
- Optional sound control button with pulse animation
- All-in-one JavaScript solution (no external CSS required)
