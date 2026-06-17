"""
INSTRUCCIONES:
1. Copiá este archivo dentro de la carpeta 'historico'
2. Abrí PowerShell y ejecutá: python agregar_calculadora_historico.py
3. Listo — modifica todos los index.html automáticamente

Requisitos: Python instalado (https://python.org)
"""

import os
import re

MARCADOR = '<p><a href="/historico/">Ver todos los históricos</a></p>'

def extraer_fecha(ruta):
    # La fecha está en la ruta: historico/2019-11-10/index.html
    partes = ruta.replace("\\", "/").split("/")
    for parte in partes:
        if re.match(r'^\d{4}-\d{2}-\d{2}$', parte):
            return parte
    return None

def formatear_fecha_es(fecha_iso):
    # 2019-11-10 -> 10/11/2019
    partes = fecha_iso.split("-")
    return f"{partes[2]}/{partes[1]}/{partes[0]}"

def generar_bloque(fecha_iso):
    fecha_display = formatear_fecha_es(fecha_iso)
    return f"""
    <!-- Calculadora histórica ¿Qué hubiera pasado? -->
    <div style="margin: 2rem 0; padding: 1.5rem; background: #0d1117; border: 1px solid #1e2330; border-radius: 12px; font-family: system-ui, sans-serif;">
      <p style="margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #00c896;">
        ¿Qué hubiera pasado?
      </p>
      <p style="margin: 0 0 1.25rem; font-size: 1.1rem; font-weight: 700; color: #e8eaf0; line-height: 1.3;">
        Si este día ({fecha_display}) tenías pesos guardados, ¿cuánto valdrían hoy?
      </p>
      <a href="/calculadora?fecha={fecha_iso}&monto=100000"
         style="display: inline-block; background: #00c896; color: #0d1117; padding: 0.65rem 1.4rem; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem;">
        Calculá con $100.000 de este día →
      </a>
    </div>

"""

def procesar():
    carpeta_base = os.path.dirname(os.path.abspath(__file__))
    modificados = 0
    omitidos = 0
    errores = 0

    for raiz, dirs, archivos in os.walk(carpeta_base):
        for archivo in archivos:
            if archivo != "index.html":
                continue

            ruta = os.path.join(raiz, archivo)

            try:
                with open(ruta, "r", encoding="utf-8") as f:
                    contenido = f.read()

                # Saltar si ya tiene la calculadora
                if "¿Qué hubiera pasado?" in contenido:
                    omitidos += 1
                    continue

                # Extraer fecha de la ruta
                fecha = extraer_fecha(ruta)
                if not fecha:
                    print(f"  ⚠️  No se pudo extraer fecha: {ruta}")
                    errores += 1
                    continue

                # Verificar marcador
                if MARCADOR not in contenido:
                    print(f"  ⚠️  Sin marcador: {ruta}")
                    errores += 1
                    continue

                # Inyectar bloque
                bloque = generar_bloque(fecha)
                nuevo = contenido.replace(MARCADOR, bloque + "    " + MARCADOR)

                with open(ruta, "w", encoding="utf-8") as f:
                    f.write(nuevo)

                modificados += 1
                if modificados % 500 == 0:
                    print(f"  ... {modificados} archivos procesados")

            except Exception as e:
                print(f"  ❌ Error en {ruta}: {e}")
                errores += 1

    print("\n" + "="*40)
    print(f"✅ Modificados:   {modificados}")
    print(f"⏭️  Ya tenían CTA: {omitidos}")
    print(f"❌ Errores:       {errores}")
    print("="*40)
    input("\nPresioná Enter para cerrar...")

procesar()
