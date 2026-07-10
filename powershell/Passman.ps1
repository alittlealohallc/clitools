

# set encrypted data file locations
$encryptedPassFile = "~/Downloads/encrypted.pass"
$encryptedKeysFile = "~/Downloads/encrypted.key"

# create encryption key
$encryptionKeyBytes = New-Object Byte[] 32
[Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($EncryptionKeyBytes)
$encryptionKeyBytes | Out-File $encryptedKeysFile

# encrypt data using secure password and save to file
# Read-Host -AsSecureString | ConvertFrom-SecureString | Out-File -FilePath $encryptedPassFile

# encrypt data using encryption key
$encryptionKeyData = Get-Content $encryptedKeysFile
Read-Host -AsSecureString | ConvertFrom-SecureString -Key $encryptionKeyData | Out-File -FilePath $encryptedPassFile

# decrypt data using secure password
# $encryptedData = Get-Content $encryptedPassFile
# $passwordSecureString = ConvertTo-SecureString $encryptedData
# $plainTextPassword = $PlainTextPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PasswordSecureString))

# decrypt using encryption key
$encryptionKeyData = Get-Content $encryptedKeysFile
$passwordSecureString = Get-Content $encryptedKeysFile | ConvertTo-SecureString -Key $encryptionKeyData
$plainTextPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordSecureString))

$plainTextPassword