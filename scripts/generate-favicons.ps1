# Generate Multi-theme Favicons and ICO files
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "."
$sourceLightPath = Join-Path $root "apps/web/public/icons/Asset 3@2x.png"
$sourceDarkPath = Join-Path $root "apps/web/public/icons/Asset 3@2x1.png"

Write-Host "Source Light: $sourceLightPath"
Write-Host "Source Dark: $sourceDarkPath"

$imgLight = [System.Drawing.Image]::FromFile($sourceLightPath)
$imgDark = [System.Drawing.Image]::FromFile($sourceDarkPath)

function Resize-Image($srcImage, $width, $height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImage, 0, 0, $width, $height)
    $g.Dispose()
    return $bmp
}

function Save-Ico($bitmaps, $outputPath) {
    # Custom ICO builder with multiple embedded PNG streams
    $pngStreams = @()
    foreach ($bmp in $bitmaps) {
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngStreams += @{
            Width = $bmp.Width
            Height = $bmp.Height
            Bytes = $ms.ToArray()
        }
        $ms.Dispose()
    }

    $numImages = $pngStreams.Count
    $headerSize = 6
    $entrySize = 16
    $dataOffset = $headerSize + ($entrySize * $numImages)

    $fs = New-Object System.IO.FileStream($outputPath, [System.IO.FileMode]::Create)
    $bw = New-Object System.IO.BinaryWriter($fs)

    # ICONDIR header
    $bw.Write([UInt16]0) # Reserved
    $bw.Write([UInt16]1) # Type 1 = Icon
    $bw.Write([UInt16]$numImages) # Count

    $currentOffset = $dataOffset
    foreach ($entry in $pngStreams) {
        $w = if ($entry.Width -ge 256) { 0 } else { [byte]$entry.Width }
        $h = if ($entry.Height -ge 256) { 0 } else { [byte]$entry.Height }
        $bw.Write($w) # Width
        $bw.Write($h) # Height
        $bw.Write([byte]0) # Color Count
        $bw.Write([byte]0) # Reserved
        $bw.Write([UInt16]1) # Planes
        $bw.Write([UInt16]32) # Bit Count
        $bw.Write([UInt32]$entry.Bytes.Length) # Bytes in Res
        $bw.Write([UInt32]$currentOffset) # Image Offset
        $currentOffset += $entry.Bytes.Length
    }

    foreach ($entry in $pngStreams) {
        $bw.Write($entry.Bytes)
    }

    $bw.Close()
    $fs.Close()
}

$destDirs = @(
    "apps/web/public",
    "apps/panels/public",
    "apps/rm-distributors/public"
)

# Generate bitmaps
$light16 = Resize-Image $imgLight 16 16
$light32 = Resize-Image $imgLight 32 32
$light48 = Resize-Image $imgLight 48 48
$light180 = Resize-Image $imgLight 180 180
$light192 = Resize-Image $imgLight 192 192
$light512 = Resize-Image $imgLight 512 512

$dark16 = Resize-Image $imgDark 16 16
$dark32 = Resize-Image $imgDark 32 32
$dark48 = Resize-Image $imgDark 48 48
$dark180 = Resize-Image $imgDark 180 180
$dark192 = Resize-Image $imgDark 192 192
$dark512 = Resize-Image $imgDark 512 512

foreach ($relDest in $destDirs) {
    $targetPub = Join-Path $root $relDest
    $iconsDir = Join-Path $targetPub "icons"
    if (-not (Test-Path $iconsDir)) {
        New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
    }

    # Save ICOs
    Save-Ico @($light16, $light32, $light48) (Join-Path $targetPub "favicon.ico")
    Save-Ico @($light16, $light32, $light48) (Join-Path $iconsDir "favicon.ico")
    Save-Ico @($light16, $light32, $light48) (Join-Path $iconsDir "favicon-light.ico")
    Save-Ico @($dark16, $dark32, $dark48) (Join-Path $iconsDir "favicon-dark.ico")

    # Save Light PNGs
    $light16.Save((Join-Path $iconsDir "favicon-16x16.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $light32.Save((Join-Path $iconsDir "favicon-32x32.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $light48.Save((Join-Path $iconsDir "favicon-48x48.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $light32.Save((Join-Path $iconsDir "favicon-light.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $light180.Save((Join-Path $iconsDir "apple-touch-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $light192.Save((Join-Path $iconsDir "icon-192x192.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $light512.Save((Join-Path $iconsDir "icon-512x512.png"), [System.Drawing.Imaging.ImageFormat]::Png)

    # Save Dark PNGs
    $dark16.Save((Join-Path $iconsDir "favicon-dark-16x16.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $dark32.Save((Join-Path $iconsDir "favicon-dark-32x32.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $dark48.Save((Join-Path $iconsDir "favicon-dark-48x48.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $dark32.Save((Join-Path $iconsDir "favicon-dark.png"), [System.Drawing.Imaging.ImageFormat]::Png)

    Write-Host "[OK] Favicons & ICO generated for $relDest" -ForegroundColor Green
}

$imgLight.Dispose()
$imgDark.Dispose()
