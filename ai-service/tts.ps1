$voice = New-Object -ComObject SAPI.SpVoice
$file = New-Object -ComObject SAPI.SpFileStream
$file.Open('temp_transcribe_test.wav', 3, $false)
$voice.AudioOutputStream = $file
$voice.Speak('Hello world, this is a Whisper transcription test.')
$file.Close()
Write-Host 'CREATED'
