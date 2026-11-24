<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.png">
  <img src="./assets/banner.png" width="92%" alt="Banner de Squad Smart Shuffle: seis siluetas de soldados en dos grupos de tres sobre las palabras SQUAD y SMART SHUFFLE, unidas por dos flechas de intercambio">
</picture>

# Squad-SmartShuffle

**Mezcla inteligente de equipos para servidores de Squad. Al final de la ronda puntúa a cada jugador solo con esa partida, reparte los equipos de forma equilibrada y bloquea los cambios de equipo durante una ronda.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-A78BFA?style=for-the-badge&logo=gnu&logoColor=white)](./LICENSE)
[![Version](https://img.shields.io/github/v/release/Miabeyefendi/Squad-SmartShuffle?style=for-the-badge&color=F59E0B&label=version)](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest)
[![Platform](https://img.shields.io/badge/SquadJS_%7C_ModLoader-1E293B?style=for-the-badge&logo=nodedotjs&logoColor=white)](#-instalación)
[![Status](https://img.shields.io/badge/status-active-22C55E?style=for-the-badge)](#)
[![Author](https://img.shields.io/badge/by-Miabeyefendi-0EA5E9?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Miabeyefendi)

[English](./README.md) · [Türkçe](./README_TR.md) · **Español** · [简体中文](./README_ZH.md) · [Русский](./README_RU.md)

[Instalación](#-instalación) · [Funciones](#-lo-destacado) · [Uso](#-inicio-rápido) · [Cambios](./CHANGELOG.md)

<a href="https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest">
  <img src="./assets/btn-download.svg" height="52" alt="Descargar la última versión">
</a>
<a href="./CHANGELOG.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/btn-changelog-dark.svg">
    <img src="./assets/btn-changelog.svg" height="52" alt="Leer el registro de cambios">
  </picture>
</a>

</div>

---

## ✨ Lo destacado

- **Puntúa jugadores, no equipos** - bajas, derribos, muertes, daño, reanimaciones y desplegables por minuto, suavizados para quien juega poco
- **Solo esta sesión** - esta partida y las últimas rondas de la misma sesión, guardadas solo en memoria; sin base de datos, no se escribe nada en disco
- **Bueno en todo vence a bueno en una sola cosa** - media geométrica ponderada, así quien solo acumula bajas no supera a un jugador completo
- **Equilibrado en cada eje** - además de la fuerza total, se reparten por igual el ritmo de bajas, el daño, las muertes, las reanimaciones, la construcción y los kits (médico, tripulación de vehículo)
- **Líderes de escuadra repartidos por grupo** - los SL de vehículo, las escuadras pequeñas cerradas y las abiertas se dividen por separado
- **Los grupos de amigos siguen juntos** - el modo de bloqueo 2 mantiene cada party en un solo lado
- **Bloqueo de una ronda** - tras una mezcla, quien cambia de equipo (o se reconecta para hacerlo) vuelve a su lado hasta que acabe la ronda
- **Tres vías** - un plugin de SquadJS para servidores sin mods, una vía híbrida con un pequeño ruleset de ModLoader para el marcador completo y un Blueprint puro de ModLoader

---

## 📦 Instalación

### Requisitos

| Vía | Necesita | El servidor sigue sin mods |
|---|---|---|
| SquadJS | [SquadJS](https://github.com/Team-Silver-Sphere/SquadJS) 4.x en el servidor | Sí, los jugadores no descargan nada |
| Híbrida | SquadJS + [ModLoader](https://steamcommunity.com/sharedfiles/filedetails/?id=3516838562) + el ruleset de volcado | No, servidor con mods |
| ModLoader | ModLoader + el ruleset en Blueprint | No, servidor con mods |

### Hecho con

![JavaScript](https://img.shields.io/badge/JavaScript-1E293B?style=for-the-badge&logo=javascript&logoColor=A78BFA)
![Node.js](https://img.shields.io/badge/Node.js-1E293B?style=for-the-badge&logo=nodedotjs&logoColor=A78BFA)
![Unreal Engine](https://img.shields.io/badge/Unreal_Engine-1E293B?style=for-the-badge&logo=unrealengine&logoColor=A78BFA)

### Vía SquadJS

1. Descarga `smart-shuffle.js` de la [última versión de SquadJS](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest).
2. Cópialo en `SquadJS/squad-server/plugins/`.
3. Añade el plugin a la lista `plugins` de `config.json`:

```json
{
  "plugin": "SmartShuffle",
  "enabled": true,
  "autoShuffle": false,
  "lockMode": 2
}
```

4. Reinicia SquadJS.

### 🎛️ Presets listos

La versión **[Smart Shuffle](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest)** contiene todos los presets. `<Nombre>.zip` solo necesita SquadJS; `Modloader-<Nombre>.zip` es el mismo preset en la ruta híbrida (SquadJS + ModLoader + el elemento SmartShuffle del Workshop, marcador completo). Cada zip contiene `smart-shuffle.js` (SquadJS 1.4.0) y una entrada completa de `config.json` con los ajustes de bloqueo, grupos, historial y menos movimientos. [`All-presets.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/All-presets.zip) los contiene todos.

Los diez pasos forman una escalera: el paso 1 da los equipos más parejos; cada paso siguiente mueve menos jugadores y mantiene enteros más grupos de amigos, a cambio de más partidas aplastantes.

| Paso | Archivo de la versión | Partidas aplastantes | Jugadores movidos | Grupos enteros | Ideal para |
|:---:|---|:---:|:---:|:---:|---|
| **1** | [`Strict.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Strict.zip) · [`Modloader-Strict.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Strict.zip) | **10.7%** | **33%** | **42%** | los equipos más parejos, los dúos siguen juntos |
| | [`Default.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Default.zip) · [`Modloader-Default.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Default.zip) *(el plugin tal como viene)* | 11.2% | 50% | 84% | |
| **2** | [`Tight.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Tight.zip) · [`Modloader-Tight.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Tight.zip) | **11.7%** | **22%** | **65%** | equipos parejos, los tríos siguen juntos |
| **3** | [`Balanced.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Balanced.zip) · [`Modloader-Balanced.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Balanced.zip) | **12.5%** | **18%** | **85%** | la mayoría de servidores |
| **4** | [`Steady.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Steady.zip) · [`Modloader-Steady.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Steady.zip) | **13.1%** | **15%** | **86%** | la mayoría de servidores, menos movimientos |
| **5** | [`Calm.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Calm.zip) · [`Modloader-Calm.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Calm.zip) | **14.2%** | **13%** | **86%** | jugadores a los que no les gusta que los muevan |
| **6** | [`Squads.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Squads.zip) · [`Modloader-Squads.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Squads.zip) | **14.6%** | **12%** | **89%** | escuadras de amigos de hasta 6 |
| **7** | [`Relaxed.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Relaxed.zip) · [`Modloader-Relaxed.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Relaxed.zip) | **16.6%** | **11%** | **90%** | pocos movimientos antes que equilibrio estricto |
| **8** | [`Easy.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Easy.zip) · [`Modloader-Easy.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Easy.zip) | **19.0%** | **9%** | **90%** | solo corregir desequilibrios claros |
| **9** | [`Together.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Together.zip) · [`Modloader-Together.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Together.zip) | **21.7%** | **9%** | **99%** | clanes y grupos grandes |
| **10** | [`Light.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Light.zip) · [`Modloader-Light.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest/download/Modloader-Light.zip) | **24.0%** | **8%** | **99%** | la mezcla más pequeña |
| | *mezcla aleatoria (sin plugin)* | 29.3% | 50% | 24% | |

Partidas aplastantes: proporción de partidas con una diferencia de tickets mayor de 150, media de tres mundos simulados. Jugadores movidos: proporción del servidor que cambia de equipo en una mezcla. Detalles en [Cómo funciona](#-cómo-funciona).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/ladder-chart-dark.svg">
    <img src="./assets/ladder-chart.svg" width="92%" alt="Preset ladder, ten steps: stomped matches rise from 10.7% (step 1) to 24.0% (step 10), players moved fall from 33% to 8%, parties kept whole rise from 42% to 99%. No preset: 11.2%, 50%, 84%. Random shuffle: 29.3%, 50%, 24%">
  </picture>
</p>

**Qué cambia de un paso a otro.** Los diez usan `lockMode` 2, `keepParties` true, `historyRounds` 8 y `historyHours` 12; solo cambian estos dos ajustes:

| Paso | Preset | `maxPartySize` | `fewerMoves` |
|:---:|---|:---:|:---:|
| 1 | `Strict` | 2 | 0.1 |
| 2 | `Tight` | 3 | 0.3 |
| 3 | `Balanced` | 4 | 0.3 |
| 4 | `Steady` | 4 | 0.6 |
| 5 | `Calm` | 4 | 1 |
| 6 | `Squads` | 6 | 1 |
| 7 | `Relaxed` | 6 | 2 |
| 8 | `Easy` | 6 | 4 |
| 9 | `Together` | sin límite | 2 |
| 10 | `Light` | sin límite | 4 |

Los presets Modloader también se simularon: quedan a cerca de medio punto de los valores vanilla de arriba, porque la ruta híbrida puntúa con el marcador completo pero no cuenta el historial de sesión. Su README explica los pasos de ModLoader en el servidor.

<details>
<summary><b>Vía híbrida (marcador completo)</b></summary>

1. Instala la vía SquadJS de arriba y pon `"useScoreboardDump": true`.
2. En el servidor, instala [ModLoader](https://steamcommunity.com/sharedfiles/filedetails/?id=3516838562) y el [elemento SmartShuffle del Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3835528773) (ID 3835528773).
3. En `Saved/ModLoader/ModLoader.json` (versión 2) añade `"/SmartShuffle/BP_SmartShuffleDump.BP_SmartShuffleDump_C": true` bajo `rulesets`. La forma antigua en lista se convierte sola. La carga se comprobó el 2026-11-22 en un servidor dedicado local de Windows: ModLoader añade `BP_SmartShuffleDump` como ruleset. El Blueprint se describe en [`src/hybrid/BP_SmartShuffleDump.md`](./src/hybrid/BP_SmartShuffleDump.md).

Si las líneas del volcado no llegan, el plugin vuelve por sí solo a los datos de SquadJS.

</details>

<details>
<summary><b>Vía ModLoader (sin SquadJS)</b></summary>

Crea `BP_SmartShuffle` en el Squad SDK siguiendo [`src/modloader/BP_SmartShuffle.md`](./src/modloader/BP_SmartShuffle.md)
y regístralo en `Saved/ModLoader/ModLoader.json`. Cada función del Blueprint tiene una equivalente probada con el
mismo nombre en `smart-shuffle.js`.

</details>

---

## 🚀 Inicio rápido

Escribe esto en el **chat de administración** del juego:

```
!smartshuffle now        mezclar una vez al final de esta ronda
!smartshuffle preview    mostrar qué haría una mezcla ahora, sin mover a nadie
!smartshuffle cancel     anular la mezcla pedida con now
!smartshuffle friends on mantener juntos a los grupos de amigos (parties) al mezclar, off los separa
!smartshuffle history on contar también las rondas anteriores de cada jugador en esta sesión, off usa solo esta partida
!smartshuffle mss on     mezclar la valoración histórica de MySquadStats (necesita token), desactivado por defecto
!smartshuffle auto on    mezclar al final de cada ronda
!smartshuffle lock 2     bloquear tras la mezcla y mantener juntos a los grupos de amigos
!smartshuffle unlock     quitar el bloqueo durante el resto de esta ronda
!smartshuffle status     mostrar los ajustes actuales
```

Al final de la ronda el plugin mueve a los jugadores con `AdminForceTeamChange`, anuncia cuántos se movieron y
mantiene los nuevos equipos hasta que termine la siguiente ronda.

Los jugadores solo se mueven en la pantalla final, justo al terminar la ronda. Si el siguiente mapa empieza antes, la mezcla se detiene: no se mueve a nadie en una partida en curso, así que nadie pierde su escuadra, kit o vehículo por la mezcla.

---

## 📘 Guía paso a paso

De un servidor vacío a una mezcla que funciona. Necesitas SquadJS en marcha y permisos de admin en el servidor. No hace falta programar.

### 1. Instalar

Descarga `smart-shuffle.js` de la [última versión](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest) y cópialo en `SquadJS/squad-server/plugins/`.

Abre `SquadJS/config.json`, busca la lista `"plugins": [` y añade esta entrada. Cuidado con la coma entre entradas.

```json
{
  "plugin": "SmartShuffle",
  "enabled": true,
  "autoShuffle": false
}
```

Reinicia SquadJS. Cada ajuste que no escribas conserva su valor por defecto, así que esta entrada corta basta.

### 2. Comprobar que se cargó

Entra al servidor y escribe esto en el **chat de admins** (no en el chat general):

```
!smartshuffle status
```

Recibes un mensaje privado como este:

```
Smart Shuffle: auto off, lock on, friends on, history on, mss off, pending 0, locked now 0.
```

¿Sin respuesta? Revisa en orden: el archivo está en la carpeta `plugins`, la entrada dice `"enabled": true`, el nombre es exactamente `SmartShuffle`, escribiste en el chat de admins y el log de SquadJS no muestra errores al iniciar.

### 3. Probar sin mover a nadie

En mitad de una partida:

```
!smartshuffle preview
```

```
Smart Shuffle preview (this match so far): 41 of 96 would move, score gap 18% -> 1%.
```

No se mueve a nadie. Recibes un resumen, y el log de SquadJS lista quién iría a dónde (`Preview moves`).

### 4. Lanzar la primera mezcla real

```
!smartshuffle now
```

Se avisa al servidor de que se equilibrarán los equipos. Al terminar la ronda, los jugadores se mueven en la pantalla final, antes de que cargue el siguiente mapa. Recibes un informe:

```
Smart Shuffle report: 44 moved, 0 not placed, score gap 21% -> 1%, done in 3.2 s.
```

¿Cambiaste de idea antes del final de la ronda? `!smartshuffle cancel`.

### 5. Hacerlo automático

`!smartshuffle auto on` mezcla al final de cada ronda hasta que SquadJS se reinicie. Para conservarlo tras un reinicio, pon `"autoShuffle": true` en `config.json`.

### 6. Cambiar los valores por defecto

Hay dos formas. Un comando de chat actúa al instante y dura hasta que SquadJS se reinicie. Una línea en `config.json` es permanente y necesita reinicio. Opciones habituales:

| Quiero | En `config.json` | En el chat de admins |
|---|---|---|
| Mezclar cada ronda | `"autoShuffle": true` | `auto on` |
| Equilibrio puro, sin mantener juntos a los amigos | `"keepParties": false` | `friends off` |
| Mantener juntos grupos de amigos más grandes | `"maxPartySize": 6` | - |
| Sin bloqueo tras la mezcla | `"lockMode": 0`, más `"keepParties": true` para seguir manteniendo a los amigos | `lock off` |
| Solo la partida que acaba de terminar | `"historyRounds": 0` | `history off` |
| Tiempo para leer el marcador antes | `"shuffleDelaySeconds": 15` | - |
| Sin mensajes a los jugadores | `"announceMinutes": 0`, `"warnMovedPlayers": false`, `"broadcastResult": false` | - |
| Mezclar también en Invasion | `"skipLayers": ["seed", "jensen"]` | - |
| Un servidor más pequeño | `"minPlayers": 20` | - |

Una entrada con varios cambios queda así. La lista completa está en [Configuración](#️-configuración).

```json
{
  "plugin": "SmartShuffle",
  "enabled": true,
  "autoShuffle": true,
  "maxPartySize": 3,
  "shuffleDelaySeconds": 15,
  "minPlayers": 30
}
```

### 7. Opcional: valoración de MySquadStats

Desactivada por defecto y experimental: en la simulación no mejoró el equilibrio, y aún no se ha probado contra la API real. Para probarla:

1. Consigue un token. MySquadStats da uno a cada servidor participante, ver [mysquadstats.com/participate](https://mysquadstats.com/participate). Si ya usas su plugin de SquadJS, es el `accessToken` de la entrada de ese plugin.
2. Añade estas dos líneas a la entrada de SmartShuffle en `config.json`:

   ```json
   "useMySquadStats": true,
   "mySquadStatsToken": "YOUR_TOKEN"
   ```

3. Reinicia SquadJS. `!smartshuffle status` muestra ahora `mss on`. Los jugadores se consultan poco a poco durante la partida, así que la valoración se completa en los primeros minutos.

Mantén el token en privado: no publiques tu `config.json`. `!smartshuffle mss off` desactiva la valoración sin reiniciar.

---

## 🧮 Cómo funciona

1. **Recoger.** Durante la partida se cuentan, por jugador: bajas, derribos, muertes, daño, reanimaciones,
   desplegables colocados, bajas aliadas y minutos jugados. Un mapa nuevo empieza la cuenta de nuevo; las últimas rondas de la sesión se guardan en memoria para la puntuación.
2. **Puntuar.** Cada estadística pasa a un ritmo por minuto atraído hacia la media de la partida (30 minutos
   previos) y luego a una puntuación z comprimida entre 0 y 1, la mitad frente a todo el servidor y la mitad
   dentro del propio equipo. Cuatro categorías (KDA, Combate, Trabajo en equipo, Objetivo) se combinan con una
   media geométrica ponderada, con pesos propios para líderes de escuadra, médicos y jugadores de apoyo. Cada
   baja aliada resta un 10%.
3. **Repartir.** Primero se reparten los líderes de escuadra, grupo por grupo. El resto va al lado más débil y
   después los intercambios por parejas reducen a la vez la diferencia de fuerza total y la de cada dimensión extra.
4. **Bloquear.** El modo 1 mantiene a todos en su nuevo lado durante una ronda. El modo 2 primero lleva cada
   party a un solo lado y después lo mantiene.

En una simulación de 100 jugadores con partidas por tickets, la proporción de palizas (más de 150 tickets de
diferencia) bajó del 26% con una mezcla aleatoria al 10.4% con la fórmula de SquadJS y al 9.3% con el marcador
completo (vía híbrida).
Estas cifras son sin mantener a los amigos juntos. Con parties de hasta 4 juntas, la fórmula de SquadJS da alrededor del 11%; manteniendo todas las parties, incluidos los grupos de 9, alrededor del 13%.
Contando las rondas anteriores de cada jugador en la sesión (por defecto), la fórmula de SquadJS da alrededor del 9.5%.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/sim-chart-dark.svg">
    <img src="./assets/sim-chart.svg" width="92%" alt="Gráfico de barras de partidas aplastantes en simulación: mezcla aleatoria 26,6%, solo estadísticas históricas 12,6%, solo esta partida 10,3%, esta partida más rondas de la sesión 9,5%">
  </picture>
</p>

Cuatro formas de valorar a los jugadores, cada una probada en 43.200 partidas simuladas. La barra azul es el método que Smart Shuffle usa por defecto.


### Simulación de los presets

Cada paso se jugó en tres mundos simulados, 7.200 partidas en cada uno (21.600 por paso), con 100 jugadores, de 6 a 10 grupos pequeños de 2 a 4 y 1 o 2 grupos grandes de 6 a 9 por partida, grupos que empiezan en un mismo equipo como en Squad, el modelo de tickets de las rondas anteriores y el historial de sesión con un 20% de jugadores nuevos en cada ronda. Una partida cuenta como aplastante cuando la diferencia de tickets supera 150.

- **principal:** la forma de esta noche varía (15%) y los miembros de un grupo juegan mejor juntos (sinergia 15%)
- **sin sinergia:** los grupos no son más fuertes juntos
- **volátil:** la forma de esta noche varía el doble (30%)

| Paso | Preset | principal | sin sinergia | volátil |
|:---:|---|:---:|:---:|:---:|
| 1 | `Strict` | 10.0% | 10.2% | 11.9% |
|  | *sin preset (predeterminado del plugin)* | 10.5% | 11.0% | 12.2% |
| 2 | `Tight` | 10.8% | 11.1% | 13.2% |
| 3 | `Balanced` | 11.8% | 11.7% | 13.9% |
| 4 | `Steady` | 12.2% | 12.3% | 14.8% |
| 5 | `Calm` | 13.4% | 12.9% | 16.2% |
| 6 | `Squads` | 13.7% | 13.4% | 16.6% |
| 7 | `Relaxed` | 15.7% | 15.1% | 19.0% |
| 8 | `Easy` | 18.2% | 17.2% | 21.7% |
| 9 | `Together` | 21.1% | 17.9% | 26.2% |
| 10 | `Light` | 23.2% | 20.3% | 28.6% |
|  | *mezcla aleatoria (sin plugin)* | 28.0% | 27.7% | 32.1% |

Lo que mostró:

- Los diez pasos van del 10,7% al 24,0% de partidas aplastantes, mientras los jugadores movidos bajan del 33% al 8% y los grupos enteros suben del 42% al 99%. Cada columna avanza en un solo sentido.
- Cerca del 10% es el límite para lo que el plugin puede ver. Un reparto que conoce la habilidad real de cada jugador llega al 5,5 a 6%, pero todos los métodos que solo ven estadísticas de partida se quedaron en el 9,5 a 10,5%: se probaron un historial de sesión más largo o con más peso, historial de otras noches, el marcador completo de la ruta híbrida con y sin historial de sesión, equilibrar directamente las tasas por minuto, una puntuación tipo Elo a partir de los resultados de rondas anteriores y otros ajustes de prior, peso de equipo y lambda. La diferencia es el límite de puntuar a los jugadores por sus estadísticas, así que el 7 a 8% no se alcanza con estos datos.
- Pocos movimientos exigen que los grupos se queden donde están: con `fewerMoves` activo, cada grupo mantenido se queda en el lado en el que juega ahora.
- Los grupos grandes son los que más equilibrio cuestan: los pasos 9 y 10 mantienen todos los grupos, por eso son los que más suben en el mundo volátil.

Son resultados de un modelo, no datos en vivo.

---

## ⚙️ Configuración

Todas las opciones van en la entrada del plugin en el `config.json` de SquadJS.

Cada interruptor acepta `true`/`false` o `"on"`/`"off"`. Cada número acepta un número o `"off"`, y `0` siempre apaga esa función (`1` encendida, valores mayores son pasos extra).

| Clave | Por defecto | Qué hace |
|---|---|---|
| `command` | `smartshuffle` | Nombre del comando del chat de administración |
| `autoShuffle` | `false` | Mezclar al final de cada ronda |
| `lockMode` | `2` | 0 sin bloqueo, 1 bloqueo estricto, 2 bloqueo que mantiene juntas las parties |
| `keepParties` | sigue a `lockMode` | Mantener juntas las parties al mezclar, independiente del bloqueo: `true` o `false`. Si se omite, está activo con `lockMode` 2 y desactivado con 0 y 1 |
| `kitMedic` | `Medic` | Regex sobre el nombre del rol para kits de médico |
| `kitLogistics` | vacío | Regex para una clase de kit de logística, vacío significa sin usar |
| `kitCrew` | `Crewman\|Pilot` | Regex para kits de tripulación; los SL de tripulación forman su propio grupo |
| `lockedSquadMaxSize` | `3` | Una escuadra cerrada de hasta este tamaño cuenta como escuadra de amigos |
| `maxPartySize` | `4` | Modo de bloqueo 2: una party de hasta este tamaño se queda junta, una más grande se divide. 0 significa sin límite |
| `skipLayers` | `["seed", "jensen", "invasion"]` | La mezcla automática se salta una ronda cuyo nombre de layer contenga alguno de estos. `!smartshuffle now` siempre se ejecuta |
| `minPlayers` | `40` | La mezcla automática se salta una ronda con menos jugadores. `!smartshuffle now` siempre se ejecuta |
| `fewerMoves` | `0` | Mover menos jugadores. 0 está apagado. Por encima de 0 más jugadores se quedan en su lado actual y la diferencia de equilibrio puede crecer como mucho esa proporción. `0.1` mueve cerca de un tercio menos de jugadores (del 50% al 33% en la simulación) con la misma proporción de partidas aplastantes. Hasta `10`; valores mayores mueven aún menos jugadores (`4`: cerca de uno de cada diez) a cambio de más partidas aplastantes. Mientras está activo, los grupos mantenidos se quedan en el lado en el que juegan ahora |
| `lockCheckSeconds` | `5` | Con los equipos bloqueados, lee la lista de jugadores con esta frecuencia (segundos), así un cambio se deshace en segundos en lugar de unos 30. `0` = solo la actualización propia de SquadJS |
| `announceLockStart` | `on` | Avisa al servidor al empezar una ronda bloqueada de que los cambios de equipo están bloqueados |
| `announceLockEnd` | `off` | Avisa al servidor cuando el bloqueo termina al final de la ronda |
| `reportSkips` | `on` | Avisa a los admins conectados cuando se salta una mezcla automática y por qué |
| `switchTokens` | `off` | Fichas de cambio: en una ronda bloqueada un jugador puede cambiar de equipo gastando una ficha en lugar de ser devuelto. Las fichas se guardan en `tokenFile` |
| `tokenStart` | `2` | Fichas que tiene cada jugador y que recupera con el tiempo |
| `tokenMax` | `5` | Máximo de fichas por jugador. `0` = sin límite |
| `tokenRefillHours` | `24` | Una ficha gastada vuelve tras estas horas, hasta `tokenStart`. `0` = nunca |
| `tokenSeedMinutes` | `[15, 60, 180]` | Minutos de seed en un día que dan una ficha duradera cada uno: +1 a los 15 min, +2 a la 1 h, +3 a las 3 h. `[]` = sin fichas de seed |
| `tokenSeedPlayers` | `50` | El servidor cuenta como seed por debajo de estos jugadores, o en una capa llamada seed. `0` = solo capas seed |
| `tokenDecayDays` | `21` | Un jugador ausente estos días pierde una ficha ganada por periodo, nunca por debajo de `tokenStart`. `0` = nunca |
| `tokenMessages` | `on` | Mensajes privados sobre fichas: usada, restantes, ganada, caducada |
| `tokenCommand` | `tokens` | Comando de chat que cualquier jugador puede escribir para ver sus fichas (`!tokens`). `"off"` = sin comando |
| `tokenFile` | `smart-shuffle-tokens.json` | Archivo donde se guardan las fichas, relativo a la carpeta de SquadJS |
| `shuffleDelaySeconds` | `0` | Segundos de espera tras el final de la ronda antes de mover jugadores (tiempo para ver el marcador), de 0 a 25 |
| `shuffleDeadlineSeconds` | `30` | No se mueve a nadie pasados estos segundos desde el final de la ronda, y nunca después de que empiece el siguiente mapa |
| `announceMinutes` | `10` | Mientras haya una mezcla pendiente, avisar al servidor cada tantos minutos. 0 desactiva los avisos |
| `broadcastResult` | `true` | Avisar al servidor tras la mezcla de cuántos jugadores se movieron |
| `warnMovedPlayers` | `true` | Avisar a cada jugador movido con un mensaje privado de que cambió de equipo |
| `adminReport` | `true` | Enviar el resultado (movidos, no colocados, diferencia de puntuación antes y después) a los admins conectados |
| `historyRounds` | `4` | Contar también las rondas anteriores de cada jugador en esta sesión, solo en memoria: cuántas rondas atrás. 0 significa solo esta partida. No se usa en la vía híbrida |
| `historyHours` | `6` | Las rondas anteriores con más horas que esto no se cuentan |
| `useMySquadStats` | `false` | Experimental. Mezclar en la puntuación una valoración histórica de [mysquadstats.com](https://mysquadstats.com). Necesita `mySquadStatsToken` |
| `mySquadStatsToken` | vacío | Token de acceso de tu servidor para la API de MySquadStats, el que usa su plugin de SquadJS. Los tokens se dan a los servidores participantes en su Discord |
| `mySquadStatsWeight` | `0.15` | Peso de la valoración histórica en la puntuación, de 0 a 1 |
| `mySquadStatsDlc` | `vanilla` | Qué clasificación de MySquadStats leer |
| `useScoreboardDump` | `false` | Vía híbrida: leer el marcador completo del log del servidor |
| `dumpWaitSeconds` | `10` | Vía híbrida: cuánto esperar el volcado al final de la ronda |

---

## 📖 Documentación

- [**Receta Blueprint de la vía híbrida**](./src/hybrid/BP_SmartShuffleDump.md) - el ruleset de volcado y su formato de log
- [**Receta Blueprint de ModLoader**](./src/modloader/BP_SmartShuffle.md) - la versión completa dentro del juego
- [**Registro de cambios**](./CHANGELOG.md) - qué cambió en cada versión
- [**Contribuir**](./CONTRIBUTING.md) - cómo enviar un cambio
- [**Seguridad**](./SECURITY.md) - cómo informar de una vulnerabilidad en privado

Pruebas: `node --test tests/squadjs/core.test.mjs`. Comparan puntuaciones y equipos con el modelo de referencia
y ejecutan el plugin contra un servidor SquadJS simulado.

---

## 🧭 Hoja de ruta

- [ ] Ejecutar el plugin de SquadJS en un servidor real y confirmar el formato de party de `ListPlayers`
- [x] Crear y publicar en el Workshop el ruleset de volcado de la vía híbrida
- [ ] Crear el Blueprint de ModLoader

Nada de esto es una promesa. Es un proyecto personal y la lista cambia cuando
cambian mis prioridades.

---

## ❓ Preguntas frecuentes

<details>
<summary><b>¿En qué se diferencia del mezclador del juego?</b></summary>

`!randomize` mezcla al azar, así que los jugadores fuertes pueden acabar juntos. Este plugin puntúa a cada jugador
con la partida que acaba de terminar y reparte los equipos para que la fuerza total y cada tipo de aporte salgan iguales.

</details>

<details>
<summary><b>¿Guarda historial de jugadores?</b></summary>

No. Usa la partida que acaba de terminar y, por defecto, las últimas 4 rondas de cada jugador en la misma sesión (hasta 6 horas atrás). Solo viven en memoria y desaparecen cuando SquadJS se reinicia. No escribe nada en disco. Pon `historyRounds` en 0 para usar solo la partida que acaba de terminar.

</details>

<details>
<summary><b>¿Los jugadores tienen que descargar algo?</b></summary>

En la vía SquadJS no: el plugin corre junto al servidor y el servidor sigue sin mods. Las vías híbrida y ModLoader
necesitan ModLoader, que los jugadores descargan automáticamente al entrar, y el servidor aparece como modificado.

</details>

<details>
<summary><b>¿Pueden entrar jugadores de Epic Games?</b></summary>

En la vía SquadJS el servidor no cambia, así que quien puede entrar hoy podrá seguir haciéndolo. La versión de
Squad de Epic Games no admite mods, así que las vías híbrida y ModLoader son para jugadores de Steam.

</details>

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Lee primero [CONTRIBUTING.md](./CONTRIBUTING.md)
y [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Al contribuir aceptas licenciar tu
trabajo bajo la AGPL-3.0.

<div align="center">
<a href="https://github.com/Miabeyefendi/Squad-SmartShuffle/issues/new?template=bug_report.yml">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/btn-report-bug-dark.svg">
    <img src="./assets/btn-report-bug.svg" height="52" alt="Informar de un fallo">
  </picture>
</a>
<a href="https://github.com/Miabeyefendi/Squad-SmartShuffle/stargazers">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/btn-star-dark.svg">
    <img src="./assets/btn-star.svg" height="52" alt="Dar una estrella a este repositorio">
  </picture>
</a>
</div>

---

## 🙏 Créditos

- [**SquadJS**](https://github.com/Team-Silver-Sphere/SquadJS), de Team Silver Sphere - el entorno donde corre el
  plugin. Usa sus eventos de log, su RCON y `BasePlugin`, y sigue al `TeamRandomizer` estándar para mover jugadores.
- [**ModLoader**](https://steamcommunity.com/sharedfiles/filedetails/?id=3516838562), de Jhett - carga rulesets
  en capas sin mods. [SquadJSLogger](https://steamcommunity.com/sharedfiles/filedetails/?id=3586951441), del mismo
  autor, demostró que un ruleset puede escribir en el log del servidor, y la vía híbrida se apoya en eso.

---

## 🛡️ Seguridad

¿Has encontrado una vulnerabilidad? No abras una incidencia pública. Sigue el
proceso privado descrito en [SECURITY.md](./SECURITY.md).

---

## 📜 Licencia

Este proyecto está licenciado bajo la **GNU Affero General Public License v3.0
(AGPL-3.0)**, junto con los términos suplementarios del archivo
[NOTICE](./NOTICE). En resumen:

- Puedes usar, estudiar, modificar, redistribuir e incluso ganar dinero con este
  software de forma gratuita, **siempre que** mantengas el código fuente completo
  disponible bajo la AGPL-3.0, incluido cualquier uso alojado, SaaS o en red
  (AGPL Sección 13), y conserves la atribución de autoría indicada abajo.
- Para usar esta obra en un producto propietario o de código cerrado, o para
  ejecutarla como un SaaS cerrado, necesitas una **licencia comercial escrita
  aparte**, que puede incluir regalías o reparto de ingresos. Consulta
  [NOTICE](./NOTICE), Sección 8, y contacta conmigo.

### Atribución (obligatoria)

Según la Sección 7(b) de la AGPL-3.0, la siguiente atribución debe conservarse de
forma visible y sin modificar en cualquier copia, bifurcación o despliegue de
este proyecto:

> **Miabeyefendi (Mustafa Ihsan Albayrak)** - https://github.com/Miabeyefendi

### Descargo de responsabilidad

Este software se proporciona "tal cual", sin garantía de ningún tipo. Lo ejecutas
por tu cuenta y riesgo y eres la única persona responsable de tu propio uso,
incluido el cumplimiento de los términos de servicio de cualquier plataforma de
terceros con la que interactúe. Esas plataformas no están afiliadas al autor ni
lo respaldan; sus nombres y marcas pertenecen a sus respectivos propietarios. El
autor no acepta responsabilidad alguna por bloqueos de cuenta, pérdida de datos
ni ningún otro daño, en la máxima medida permitida por la ley aplicable. Los
términos completos están en los archivos [LICENSE](./LICENSE) y
[NOTICE](./NOTICE).

---

## 📬 Contacto

- GitHub: [@miabeyefendi](https://github.com/Miabeyefendi)
- Para licencias comerciales o consultas sobre reparto de ingresos, escríbeme a
  través de mi perfil de GitHub.

<div align="center">
<br/>
<img src="./assets/divider.svg" width="100%" height="3" alt="">
<br/>
<sub>Creado por <b><a href="https://github.com/Miabeyefendi">Miabeyefendi</a></b></sub>
</div>
