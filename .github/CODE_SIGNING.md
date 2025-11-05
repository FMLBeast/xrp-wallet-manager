# Code Signing Setup Guide

This guide explains how to set up code signing for XRP Wallet Manager releases across all platforms.

## 🍎 macOS Code Signing

### Requirements
- Apple Developer Program membership ($99/year)
- Xcode installed on macOS
- Developer ID Application certificate

### Setup Steps

1. **Create certificates in Apple Developer Console:**
   - Log into [Apple Developer](https://developer.apple.com)
   - Go to Certificates, Identifiers & Profiles
   - Create a "Developer ID Application" certificate
   - Download the certificate and install in Keychain

2. **Export certificate for CI:**
   ```bash
   # Export from Keychain as .p12 file
   security find-identity -v -p codesigning
   security export -t p12 -f pkcs12 -k ~/Library/Keychains/login.keychain -P "password" -o certificate.p12 "Developer ID Application: Your Name"

   # Convert to base64 for GitHub Secrets
   base64 -i certificate.p12 | pbcopy
   ```

3. **Add GitHub Secrets:**
   - `MAC_CERTIFICATE_BASE64`: Base64 encoded .p12 file
   - `MAC_CERTIFICATE_PASSWORD`: Password for .p12 file
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password from Apple ID
   - `APPLE_TEAM_ID`: Your Developer Team ID

### App-Specific Password Setup
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Go to "App-Specific Passwords"
4. Generate a new password for "XRP Wallet Manager CI"

## 🪟 Windows Code Signing

### Requirements
- Code signing certificate (from DigiCert, Sectigo, etc.)
- Windows 10/11 SDK

### Setup Steps

1. **Obtain certificate:**
   - Purchase from certificate authority (DigiCert, Sectigo, etc.)
   - Or use self-signed for testing (not recommended for distribution)

2. **Export certificate:**
   ```powershell
   # Export as .p12/.pfx from Certificate Manager
   # Or convert from .crt/.key:
   openssl pkcs12 -export -out certificate.p12 -inkey private-key.key -in certificate.crt

   # Convert to base64
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.p12")) | Set-Clipboard
   ```

3. **Add GitHub Secrets:**
   - `WIN_CERTIFICATE_BASE64`: Base64 encoded .p12/.pfx file
   - `WIN_CERTIFICATE_PASSWORD`: Password for certificate file

## 🐧 Linux

Linux builds don't require code signing, but packages are still built and checksummed for integrity verification.

## 🔐 Security Best Practices

### Repository Secrets Management
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add repository secrets (never commit these!)

### Environment Protection
Consider setting up environment protection rules:
1. Settings → Environments
2. Create "production" environment
3. Add protection rules:
   - Required reviewers
   - Wait timer
   - Deployment branches

### Certificate Security
- **Never commit certificates to git**
- Use short-lived certificates when possible
- Rotate certificates before expiration
- Monitor certificate usage in audit logs

## 🚀 Release Process

### Automatic Releases
```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

### Manual Release Workflow
1. Go to Actions tab in GitHub
2. Select "Code Signing Release" workflow
3. Click "Run workflow"
4. Enter the release tag

## 🔍 Verification

### macOS
```bash
# Verify code signature
codesign -v --verbose=4 "XRP Wallet Manager.app"

# Check notarization
spctl -a -v "XRP Wallet Manager.app"
```

### Windows
```powershell
# Verify signature
Get-AuthenticodeSignature "XRP Wallet Manager Setup.exe"

# Check with signtool
signtool verify /pa "XRP Wallet Manager Setup.exe"
```

### Linux
```bash
# Verify checksums
sha256sum -c checksums-linux.txt
```

## 📋 Troubleshooting

### Common Issues

**macOS:**
- `errSecInternalComponent`: Certificate not in Keychain
- `CSSMERR_TP_NOT_TRUSTED`: Certificate chain issue
- Notarization timeout: Apple servers busy, retry later

**Windows:**
- `SignTool Error: No certificates were found`: Certificate not installed
- Timestamp server issues: Check internet connection

**General:**
- Build artifacts missing: Check if previous steps completed
- Permission denied: Verify repository secrets are set correctly

### Debug Commands
```bash
# Check environment variables (in CI)
echo "CSC_LINK length: ${#CSC_LINK}"
echo "Certificate password set: $([ -n "$CSC_KEY_PASSWORD" ] && echo 'yes' || echo 'no')"

# Test certificate import
security import certificate.p12 -P "password" -k ~/Library/Keychains/build.keychain -T /usr/bin/codesign
```

## 📚 Additional Resources

- [Electron Builder Code Signing](https://www.electron.build/code-signing)
- [Apple Developer Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Microsoft Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-portal)
- [GitHub Actions Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)