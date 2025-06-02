#!/bin/bash

# Setup script to copy PrimeReact themes to public folder
# This is required for the PrimeReact changeTheme function to work

echo "Setting up PrimeReact themes for dynamic theme switching..."

# Create themes directory in public folder
mkdir -p public/themes

# Copy Bootstrap themes from node_modules to public folder
echo "Copying Bootstrap light theme..."
cp -r node_modules/primereact/resources/themes/bootstrap4-light-blue public/themes/

echo "Copying Bootstrap dark theme..."
cp -r node_modules/primereact/resources/themes/bootstrap4-dark-blue public/themes/

# Alternative: Copy Lara themes (more modern)
echo "Copying Lara light theme..."
cp -r node_modules/primereact/resources/themes/lara-light-indigo public/themes/

echo "Copying Lara dark theme..."
cp -r node_modules/primereact/resources/themes/lara-dark-indigo public/themes/

echo "✅ PrimeReact themes setup complete!"
echo ""
echo "Available themes in public/themes/:"
ls -la public/themes/
echo ""
echo "You can now use the PrimeReact changeTheme function to switch between:"
echo "- /themes/bootstrap4-light-blue/theme.css"
echo "- /themes/bootstrap4-dark-blue/theme.css"
echo "- /themes/lara-light-indigo/theme.css"
echo "- /themes/lara-dark-indigo/theme.css"
