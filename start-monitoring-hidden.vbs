Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Stop any existing sessions silently
WshShell.Run chr(34) & scriptPath & "\infogenerator.exe" & chr(34) & " -stop", 0, True

' Start silently without any windows
WshShell.Run chr(34) & scriptPath & "\infogenerator.exe" & chr(34) & " -start -silent -interval 30", 0, False

Set fso = Nothing
Set WshShell = Nothing