const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');


exports.default = async function(context) {
    if (process.platform !== 'darwin') {
        console.log('Skipping afterAllArtifactBuild: Not on macOS');
        return;
    }

    require('dotenv').config();
    const DEVELOPER_ID_INSTALLER = process.env.DEVELOPER_ID_INSTALLER;
    if (!DEVELOPER_ID_INSTALLER) {
        throw new Error('DEVELOPER_ID_INSTALLER environment variable is not set');
    }
    
    try {
        // Setup paths
        // Get current directory
        const currentPath = process.cwd();
        console.log('Current path:', currentPath);
        
        // Get the .pkg file
        console.log('Out dir:', context.outDir);
        const pkgFiles = fs.readdirSync(context.outDir).filter(file => file.endsWith('.pkg'));
        if (pkgFiles.length === 0) {
            throw new Error('No .pkg file found');
        }
        const pkgFile = pkgFiles[0];
        console.log('Pkg file:', pkgFile);

        // Get the signed .pkg file
        const signedPkgFile = pkgFile.replace('.pkg', '-installer.pkg');
        console.log('Signed pkg file:', signedPkgFile);

        // Sign the pkg file
        execSync(`productsign --sign "Developer ID Installer: NICOLAS LONGCHAMPS (5ML683U677)" "${path.join(context.outDir, pkgFile)}" "${path.join(context.outDir, signedPkgFile)}"`);
        

        console.log('AfterAllArtifactBuild: Signing completed successfully');

        process.chdir(currentPath);
        console.log('Changed back to:', process.cwd());
        
    } catch (error) {
        console.error('afterAllArtifactBuild error:', error);
        throw error;
    }
};