# Creates a self-signed code-signing certificate for LOCAL/TEST signed builds.
# Produces build\lil-agents-cert.pfx (password: lilagents).
#
# NOTE: A self-signed cert makes the installer *signed* (shows a publisher and
# passes integrity checks) but is NOT trusted by Windows SmartScreen on other
# machines. For public distribution without warnings, replace this with an
# OV/EV code-signing certificate from a trusted CA (DigiCert, Sectigo, etc.)
# and point CSC_LINK / CSC_KEY_PASSWORD at it (see README).

$ErrorActionPreference = 'Stop'
$pfxPath = Join-Path $PSScriptRoot 'lil-agents-cert.pfx'
$password = 'lilagents'

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject 'CN=lil agents, O=lil agents, C=US' `
  -KeyAlgorithm RSA -KeyLength 2048 `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears(5) `
  -FriendlyName 'lil agents code signing (self-signed)'

$secure = ConvertTo-SecureString -String $password -Force -AsPlainText
Export-PfxCertificate -Cert "Cert:\CurrentUser\My\$($cert.Thumbprint)" -FilePath $pfxPath -Password $secure | Out-Null

# clean the cert out of the personal store (the .pfx is the artifact we keep)
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Output "Created $pfxPath (password: $password)"
