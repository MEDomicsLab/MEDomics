import { flat } from '@electron/osx-sign'
flat({
    app: '/Users/nicolas/Documents/GitHub/MEDomicsLab/build/dist/mac-arm64/MEDomicsLab.app',
    platform: 'darwin',
    identity: 'Developer ID Installer: NICOLAS LONGCHAMPS (5ML683U677)',
    identityValidation: true,
    pkg: '/Users/nicolas/Documents/GitHub/MEDomicsLab/build/dist/mac-arm64/MEDomicsLab.pkg',
    scripts: '/Users/nicolas/Documents/GitHub/MEDomicsLab/build/pkg-scripts',
    relocatable: false,
})
    .then(function () {
        console.log('App successfully signed')
    })
    .catch(function (error) {
        console.error('Error signing app:', error)
    })
