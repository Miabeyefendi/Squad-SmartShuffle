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

La versión **[Presets 1.1.0](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/presets-v1.1.0)** tiene un zip por preset. Cada zip contiene el `smart-shuffle.js` de **[SquadJS 1.2.0](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/squadjs-v1.2.0)**, la entrada para `config.json` y un `README.txt` corto: descomprime uno, copia el plugin y pega la entrada. Ordenados de los equipos más parejos a los menos:

| Puesto | Archivo de la versión | Tipo | Ideal para | Partidas aplastantes | Jugadores movidos | Grupos que se mantienen |
|:---:|---|---|---|:---:|:---:|:---:|
| **1** | [`SmartShuffle-quality-max.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/download/presets-v1.1.0/SmartShuffle-quality-max.zip) | Calidad | los equipos más parejos | **10.6%** | 33% | ninguno |
| **2** | [`SmartShuffle-quality-session.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/download/presets-v1.1.0/SmartShuffle-quality-session.zip) | Calidad | los mismos habituales durante horas | **10.7%** | 33% | ninguno |
| **3** | [`SmartShuffle-quality-fresh.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/download/presets-v1.1.0/SmartShuffle-quality-fresh.zip) | Calidad | servidores públicos con mucho ir y venir | **10.7%** | 33% | ninguno |
| **4** | [`SmartShuffle-friends-small.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/download/presets-v1.1.0/SmartShuffle-friends-small.zip) | Amigos | jugadores que quieren seguir con uno o dos amigos | **11.1%** | 36% | 60% |
| | *sin preset (predeterminado del plugin)* | | | 11.2% | 50% | 84% |
| **5** | [`SmartShuffle-friends-squad.zip`](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/download/presets-v1.1.0/SmartShuffle-friends-squad.zip) | Amigos | clanes y grupos que juegan como escuadra | **11.5%** | 36% | 88% |
| | *mezcla aleatoria (sin plugin)* | | | 29.2% | 50% | 24% |

Partidas aplastantes: proporción de partidas con una diferencia de tickets mayor de 150, media de tres mundos simulados, menos es mejor. Jugadores movidos: proporción del servidor que cambia de equipo en una mezcla. Detalles en [Cómo funciona](#-cómo-funciona).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/preset-chart-dark.svg">
    <img src="./assets/preset-chart.svg" width="92%" alt="Bar chart of stomped matches by preset, best first: 1 quality-max 10.6%, 2 quality-session 10.7%, 3 quality-fresh 10.7%, 4 friends-small 11.1%, no preset 11.2%, 5 friends-squad 11.5%, random shuffle 29.2%">
  </picture>
</p>

**Qué cambia cada preset**, en el mismo orden. Todo lo demás queda en el valor predeterminado del plugin.

| Puesto | Preset | `lockMode` | `maxPartySize` | `historyRounds` | `historyHours` | `fewerMoves` |
|:---:|---|:---:|:---:|:---:|:---:|:---:|
| 1 | `quality-max` | 1 | - | 4 | 6 | 0.1 |
| 2 | `quality-session` | 1 | - | 8 | 12 | 0.1 |
| 3 | `quality-fresh` | 1 | - | 2 | 3 | 0.1 |
| 4 | `friends-small` | 2 | 3 | 2 | 6 | 0.1 |
|  | *sin preset (predeterminado del plugin)* | 2 | 4 | 4 | 6 | 0 |
| 5 | `friends-squad` | 2 | 6 | 4 | 6 | 0.1 |

Para el comportamiento anterior, en el que se mueve cerca de la mitad del servidor, usa la versión [Presets 1.0.0](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/tag/presets-v1.0.0).

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

Cada preset se jugó en tres mundos simulados, 7.200 partidas en cada uno (21.600 por preset), con 100 jugadores, de 6 a 10 grupos pequeños de 2 a 4 y 1 o 2 grupos grandes de 6 a 9 por partida, el modelo de tickets de las rondas anteriores y el mismo historial de sesión con un 20% de jugadores nuevos en cada ronda. Una partida cuenta como aplastante cuando la diferencia de tickets supera 150.

- **principal:** la forma de esta noche varía (15%) y los miembros de un grupo juegan mejor juntos (sinergia 15%)
- **sin sinergia:** los grupos no son más fuertes juntos
- **volátil:** la forma de esta noche varía el doble (30%)

| Puesto | Preset | principal | sin sinergia | volátil |
|:---:|---|:---:|:---:|:---:|
| 1 | `quality-max` | 10.0% | 10.5% | 11.4% |
| 2 | `quality-session` | 10.4% | 10.1% | 11.7% |
| 3 | `quality-fresh` | 10.4% | 10.1% | 11.7% |
| 4 | `friends-small` | 10.6% | 10.2% | 12.4% |
|  | *sin preset (predeterminado del plugin)* | 10.7% | 10.7% | 12.1% |
| 5 | `friends-squad` | 11.0% | 10.8% | 12.8% |
|  | *mezcla aleatoria (sin plugin)* | 28.3% | 27.4% | 31.8% |

Lo que mostró:

- Los cinco presets bajan las partidas aplastantes de cerca del 28% (aleatorio) al 10 a 13% y mueven del 33 al 36% de los jugadores por mezcla en lugar del 50%.
- Los tres presets de calidad superan al predeterminado actual por 0,3 a 0,8 puntos en todos los mundos.
- Mantener amigos juntos cuesta equilibrio, y más cuanto mayor es el grupo: dúos y tríos casi no cuestan nada, grupos de hasta 6 cuestan lo mismo que el predeterminado actual, mantener todos los grupos de 7 a 9 sube las partidas aplastantes al 14% (17% en el mundo volátil). Por eso ningún preset mantiene todos los grupos.
- **Menos movimientos.** El plugin elige los dos lados sin mirar dónde está cada uno ahora, así que movía cerca de la mitad del servidor en cada mezcla. `fewerMoves` primero intercambia las etiquetas de los lados cuando eso ahorra movimientos, y luego devuelve jugadores a su lado actual por parejas mientras el equilibrio se mantenga dentro de esa proporción del mejor reparto. El punto medio es `0.1`: se mueve el 33% de los jugadores y la proporción de partidas aplastantes es la misma dentro del ruido. `0.2` mueve el 27% pero añade cerca de 0,5 puntos de partidas aplastantes. Un reparto que parte de los equipos actuales mueve solo el 19%, pero añade de 0,5 a 1 punto, así que se descartó.
- También se probó y descartó una búsqueda desde 8 repartos iniciales: menor diferencia de puntuación en teoría, pero no menos partidas aplastantes.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/moves-chart-dark.svg">
    <img src="./assets/moves-chart.svg" width="92%" alt="Bar chart of players moved per shuffle: fewerMoves off 50%, 0.1 33% (recommended), 0.2 27%, 0.3 24%, starting from the current teams 19%">
  </picture>
</p>

Son resultados de un modelo, no datos en vivo.

---

## ⚙️ Configuración

Todas las opciones van en la entrada del plugin en el `config.json` de SquadJS.

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
| `fewerMoves` | `0` | Mover menos jugadores. 0 está apagado. Por encima de 0 más jugadores se quedan en su lado actual y la diferencia de equilibrio puede crecer como mucho esa proporción. `0.1` mueve cerca de un tercio menos de jugadores (del 50% al 33% en la simulación) con la misma proporción de partidas aplastantes |
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
