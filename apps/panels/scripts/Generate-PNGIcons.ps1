# Generate PNG icons for PWA
# Requires: Windows with .NET (System.Drawing)

$ErrorActionPreference = "Stop"

# Load System.Drawing assembly first
Add-Type -AssemblyName System.Drawing

# Icon configuration
$backgroundColor = [System.Drawing.Color]::FromArgb(15, 23, 42) # #0f172a
$textColor = [System.Drawing.Color]::White
$text = "US"
$fontFamily = "Arial"

# Output directory
$outputDir = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Icon sizes
$sizes = @(
    @{ Size = 16; Name = "favicon-16x16.png" },
    @{ Size = 32; Name = "favicon-32x32.png" },
    @{ Size = 72; Name = "icon-72x72.png" },
    @{ Size = 96; Name = "icon-96x96.png" },
    @{ Size = 128; Name = "icon-128x128.png" },
    @{ Size = 144; Name = "icon-144x144.png" },
    @{ Size = 152; Name = "icon-152x152.png" },
    @{ Size = 180; Name = "apple-touch-icon.png" },
    @{ Size = 192; Name = "icon-192x192.png" },
    @{ Size = 384; Name = "icon-384x384.png" },
    @{ Size = 512; Name = "icon-512x512.png" }
)

Write-Host "Generating PNG icons..." -ForegroundColor Cyan

foreach ($config in $sizes) {
    $size = $config.Size
    $name = $config.Name
    $outputPath = Join-Path $outputDir $name
    
    try {
        # Create bitmap
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # Set high quality rendering
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
        
        # Fill background
        $brush = New-Object System.Drawing.SolidBrush($backgroundColor)
        $graphics.FillRectangle($brush, 0, 0, $size, $size)
        
        # Draw text
        $fontSize = [Math]::Floor($size * 0.35)
        $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold)
        $textBrush = New-Object System.Drawing.SolidBrush($textColor)
        
        # Measure text for centering
        $textSize = $graphics.MeasureString($text, $font)
        $x = ($size - $textSize.Width) / 2
        $y = ($size - $textSize.Height) / 2
        
        $graphics.DrawString($text, $font, $textBrush, $x, $y)
        
        # Save as PNG
        $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        # Cleanup
        $graphics.Dispose()
        $bitmap.Dispose()
        $brush.Dispose()
        $textBrush.Dispose()
        $font.Dispose()
        
        Write-Host "   $name ($size x $size)" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Failed to generate $name : $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[OK] PNG icon generation complete!" -ForegroundColor Green
Write-Host "Icons saved to: $outputDir" -ForegroundColor Cyan
