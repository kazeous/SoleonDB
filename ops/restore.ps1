# Restore is deliberately limited to a named, loopback, disposable test database.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$TestDatabaseUrl,[Parameter(Mandatory)][string]$BackupPath,[Parameter(Mandatory)][string]$ExpectedDatabaseName,[string]$DockerContainer='')
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
$process=$null
try{
 $connection=Get-PgConnection $TestDatabaseUrl
 if($connection.PGDATABASE -cne $ExpectedDatabaseName -or $ExpectedDatabaseName -notmatch '^eousbot_(?:test|restore)_[a-z0-9_]{1,40}$' -or $connection.PGHOST -notin @('localhost','127.0.0.1','::1')){throw 'Restore target is not an exact loopback test database'}
 $archive=(Resolve-Path -LiteralPath $BackupPath).ProviderPath;$item=Get-Item -LiteralPath $archive;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Select a regular backup archive'}
 $arguments=@('--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname',$ExpectedDatabaseName)
 $process=New-PgProcess 'pg_restore' $arguments $connection $DockerContainer $true
 $errorTask=$process.StandardError.ReadToEndAsync();$outputTask=$process.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null);$stream=[IO.File]::OpenRead($archive)
 try{$stream.CopyTo($process.StandardInput.BaseStream)}finally{$stream.Dispose();$process.StandardInput.Close()};$process.WaitForExit();[void]$errorTask.GetAwaiter().GetResult();[void]$outputTask.GetAwaiter().GetResult();if($process.ExitCode -ne 0){throw 'pg_restore failed'}
 Write-Output 'Restore completed in the explicitly named test database.'
}catch{Write-Error 'Restore refused or failed. Use an empty, loopback disposable database with the exact expected name; no clean or down migration is performed.' -ErrorAction Continue;exit 1}
finally{if($process){if(-not $process.HasExited){$process.Kill($true)};$process.Dispose()}}
