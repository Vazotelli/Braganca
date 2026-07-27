@echo off
REM ============================================================
REM  Arranca a app Obra Braganca no browser (duplo-clique).
REM  Serve os ficheiros deste repositorio num mini-servidor
REM  local, porque a app usa modulos ES6 e nao funciona a partir
REM  de file:// (o browser bloqueia por seguranca).
REM
REM  - No PC:        http://127.0.0.1:8099/obra/
REM  - No telemovel: http://SEU-IP:8099/obra/  (mesma Wi-Fi)
REM
REM  Fecha esta janela preta para parar o servidor.
REM ============================================================
cd /d "%~dp0"
start "" http://127.0.0.1:8099/obra/index.html
echo Servidor a correr. Fecha esta janela para parar.
python -m http.server 8099 --bind 0.0.0.0
