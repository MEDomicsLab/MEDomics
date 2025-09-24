// SSH key generation utility for Electron main process
const forge = require('node-forge')

/**
 * Generate an RSA SSH key pair
 * @param {string} comment - Comment to append to the public key
 * @param {string} username - Username for the key (optional, for comment)
 * @returns {Promise<{privateKey: string, publicKey: string}>}
 */
export async function generateSSHKeyPair(comment = '', username = '') {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keypair) => {
      if (err) return reject(err)
      const privateKey = forge.pki.privateKeyToPem(keypair.privateKey)
      // OpenSSH public key format
      const sshPublic = forge.ssh.publicKeyToOpenSSH(keypair.publicKey, `${username || 'user'}@${comment}`)
      resolve({ privateKey, publicKey: sshPublic })
    });
  });
}
