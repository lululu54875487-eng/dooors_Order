param(
  [int]$Port = 8787
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $Root "data"
$DataFile = Join-Path $DataDir "orders.json"

if (-not (Test-Path $DataDir)) {
  New-Item -ItemType Directory -Path $DataDir | Out-Null
}

if (-not (Test-Path $DataFile)) {
  @{
    eventId = [guid]::NewGuid().ToString()
    exhibitionName = ""
    exhibitionDate = ""
    headerImage = ""
    password = ""
    paymentAccount = ""
    published = $false
    products = @()
    orders = @()
  } | ConvertTo-Json -Depth 20 | Set-Content -Path $DataFile -Encoding UTF8
}

function Get-ContentType {
  param([string]$Path)
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "text/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".md" { "text/markdown; charset=utf-8" }
    default { "application/octet-stream" }
  }
}

function Send-Response {
  param(
    [Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$ContentType,
    [byte[]]$Body
  )

  $Reason = if ($Status -eq 200) { "OK" } elseif ($Status -eq 404) { "Not Found" } else { "Server Error" }
  $Header = "HTTP/1.1 $Status $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

function Send-Text {
  param(
    [Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$Text,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  Send-Response $Stream $Status $ContentType ([Text.Encoding]::UTF8.GetBytes($Text))
}

function Decode-BodyJson {
  param([string]$Body)

  $Incoming = $Body | ConvertFrom-Json
  if ($Incoming.payload) {
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Incoming.payload))
  }
  return $Body
}

$Listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $Port)
try {
  $Listener.Start()
} catch {
  Write-Host "Port $Port 已被占用，請改用其他 Port，例如："
  Write-Host "powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8789"
  throw
}

$LocalIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host "下午茶訂單網頁已啟動：http://localhost:$Port/"
if ($LocalIp) {
  Write-Host "可分享給同事：http://$LocalIp`:$Port/"
}
Write-Host "按 Ctrl+C 停止"

try {
  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [IO.StreamReader]::new($Stream, [Text.Encoding]::UTF8, $false, 8192, $true)
      $RequestLine = $Reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($RequestLine)) {
        $Client.Close()
        continue
      }

      $Parts = $RequestLine.Split(" ")
      $Method = $Parts[0]
      $Target = $Parts[1]
      $Headers = @{}

      while ($true) {
        $Line = $Reader.ReadLine()
        if ($Line -eq $null -or $Line -eq "") { break }
        $Index = $Line.IndexOf(":")
        if ($Index -gt 0) {
          $Headers[$Line.Substring(0, $Index).Trim().ToLowerInvariant()] = $Line.Substring($Index + 1).Trim()
        }
      }

      $Body = ""
      if ($Headers.ContainsKey("content-length")) {
        $Length = [int]$Headers["content-length"]
        if ($Length -gt 0) {
          $Buffer = New-Object char[] $Length
          $Read = $Reader.ReadBlock($Buffer, 0, $Length)
          if ($Read -gt 0) {
            $Body = -join $Buffer[0..($Read - 1)]
          }
        }
      }

      $Uri = [Uri]::new("http://localhost$Target")

      if ($Method -eq "OPTIONS") {
        Send-Text $Stream 200 ""
        continue
      }

      if ($Uri.AbsolutePath -eq "/api/state" -and $Method -eq "GET") {
        Send-Text $Stream 200 (Get-Content -Raw -Path $DataFile) "application/json; charset=utf-8"
        continue
      }

      if ($Uri.AbsolutePath -eq "/api/state" -and $Method -eq "POST") {
        $Json = Decode-BodyJson $Body
        $null = $Json | ConvertFrom-Json
        Set-Content -Path $DataFile -Value $Json -Encoding UTF8
        Send-Text $Stream 200 '{"ok":true}' "application/json; charset=utf-8"
        continue
      }

      if ($Uri.AbsolutePath -eq "/api/order" -and $Method -eq "POST") {
        $Order = (Decode-BodyJson $Body) | ConvertFrom-Json
        $State = Get-Content -Raw -Path $DataFile | ConvertFrom-Json
        $Existing = @($State.orders | Where-Object { $_.id -ne $Order.id })
        $State.orders = @($Existing + $Order)
        $State | ConvertTo-Json -Depth 20 | Set-Content -Path $DataFile -Encoding UTF8
        Send-Text $Stream 200 '{"ok":true}' "application/json; charset=utf-8"
        continue
      }

      $Path = [Uri]::UnescapeDataString($Uri.AbsolutePath)
      if ($Path -eq "/") {
        $Path = "/index.html"
      }

      $Relative = $Path.TrimStart("/")
      $FilePath = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
      $RootPath = [IO.Path]::GetFullPath($Root)

      if (-not $FilePath.StartsWith($RootPath) -or -not (Test-Path $FilePath -PathType Leaf)) {
        Send-Text $Stream 404 "Not found"
        continue
      }

      Send-Response $Stream 200 (Get-ContentType $FilePath) ([IO.File]::ReadAllBytes($FilePath))
    } catch {
      if ($Stream) {
        Send-Text $Stream 500 $_.Exception.Message
      }
    } finally {
      $Client.Close()
    }
  }
} finally {
  $Listener.Stop()
}
