@echo off
cd /d "C:\Users\Administrator\AppData\Roaming\openocta\workspace\transinvoice-word-counter\validate"
node gen-docs.js
node validate.js
