# Requires PowerShell 7 and PostgreSQL client tools, or an explicit PostgreSQL container.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$DatabaseUrl,[Parameter(Mandatory)][string]$OutputPath,[string]$DockerContainer='')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Get-PgConnection([string]$Value){
 try{$uri=[Uri]$Value}catch{throw 'Invalid PostgreSQL URL'}
 if($uri.Scheme -notin @('postgres','postgresql') -or -not $uri.Host -or $uri.Fragment){throw 'An explicit PostgreSQL URL is required'}
 $database=[Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'));if($database -notmatch '^[A-Za-z0-9_-]{1,63}$'){throw 'Select an explicit database name'}
 $parts=$uri.UserInfo -split ':',2;if(-not $parts[0]){throw 'An explicit database user is required'}
 $values=@{PGHOST=$uri.DnsSafeHost;PGPORT=[string]$(if($uri.Port -lt 0){5432}else{$uri.Port});PGUSER=[Uri]::UnescapeDataString($parts[0]);PGPASSWORD=$(if($parts.Count -gt 1){[Uri]::UnescapeDataString($parts[1])}else{''});PGDATABASE=$database;PGCONNECT_TIMEOUT='10'}
 if($uri.Query){foreach($entry in $uri.Query.TrimStart('?').Split('&')){$pair=$entry -split '=',2;if($pair.Count -ne 2 -or $pair[0] -ne 'sslmode' -or $pair[1] -notin @('disable','allow','prefer','require','verify-ca','verify-full')){throw 'Only sslmode is supported in the connection query'};$values.PGSSLMODE=$pair[1]}}
 return $values
}
function New-PgProcess([string]$Program,[string[]]$Arguments,[hashtable]$Connection,[string]$Container,[bool]$InputStream=$false){
 $info=[Diagnostics.ProcessStartInfo]::new();$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.RedirectStandardInput=$InputStream
 if($Container){if($Container -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$'){throw 'Invalid explicit container name'};$info.FileName=(Get-Command docker -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source;$info.ArgumentList.Add('exec');if($InputStream){$info.ArgumentList.Add('-i')};foreach($key in $Connection.Keys){$info.ArgumentList.Add('--env');$info.ArgumentList.Add($key)};$info.ArgumentList.Add($Container);$info.ArgumentList.Add($Program)}else{$info.FileName=(Get-Command $Program -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source}
 foreach($key in $Connection.Keys){$info.Environment[$key]=[string]$Connection[$key]};foreach($argument in $Arguments){$info.ArgumentList.Add($argument)}
 $process=[Diagnostics.Process]::new();$process.StartInfo=$info;[void]$process.Start();return $process
}
$temporary=$null;$process=$null
try{
 $connection=Get-PgConnection $DatabaseUrl
 $full=[IO.Path]::GetFullPath($OutputPath);if([IO.Path]::GetExtension($full) -ne '.dump'){throw 'Use a .dump archive path'}
 $directory=(Resolve-Path -LiteralPath ([IO.Path]::GetDirectoryName($full))).ProviderPath;$full=Join-Path $directory ([IO.Path]::GetFileName($full))
 if(Test-Path -LiteralPath $full){$existing=Get-Item -LiteralPath $full;if($existing.PSIsContainer -or ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Archive destination must be a regular file'}}
 $temporary=Join-Path $directory ('.'+[IO.Path]::GetFileName($full)+'.'+[Guid]::NewGuid().ToString('N')+'.partial')
 if(-not ([IO.Path]::GetFullPath($temporary)).StartsWith($directory+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid temporary archive path'}
 $process=New-PgProcess 'pg_dump' @('--format=custom','--no-owner','--no-acl') $connection $DockerContainer
 $errorTask=$process.StandardError.ReadToEndAsync();$stream=[IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
 try{$process.StandardOutput.BaseStream.CopyTo($stream)}finally{$stream.Dispose()};$process.WaitForExit();[void]$errorTask.GetAwaiter().GetResult();if($process.ExitCode -ne 0){throw 'pg_dump failed'};$process.Dispose();$process=$null
 if($DockerContainer){$process=New-PgProcess 'pg_restore' @('--list') $connection $DockerContainer $true}else{$process=New-PgProcess 'pg_restore' @('--list',$temporary) $connection ''}
 $errorTask=$process.StandardError.ReadToEndAsync();$outputTask=$process.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null)
 if($DockerContainer){$archiveStream=[IO.File]::OpenRead($temporary);try{$archiveStream.CopyTo($process.StandardInput.BaseStream)}finally{$archiveStream.Dispose();$process.StandardInput.Close()}}
 $process.WaitForExit();[void]$errorTask.GetAwaiter().GetResult();[void]$outputTask.GetAwaiter().GetResult();if($process.ExitCode -ne 0){throw 'Archive validation failed'};$process.Dispose();$process=$null
 if(Test-Path -LiteralPath $full){[IO.File]::Replace($temporary,$full,[NullString]::Value)}else{Move-Item -LiteralPath $temporary -Destination $full};$temporary=$null
 Write-Output 'Backup complete. The custom archive was validated.'
}catch{Write-Error 'Backup failed. The prior archive was retained; verify the connection, tools and output directory.' -ErrorAction Continue;exit 1}
finally{if($process){if(-not $process.HasExited){$process.Kill($true)};$process.Dispose()};if($temporary -and (Test-Path -LiteralPath $temporary)){Remove-Item -LiteralPath $temporary}}
