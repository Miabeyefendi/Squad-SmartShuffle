<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.png">
  <img src="./assets/banner.png" width="92%" alt="Баннер Squad Smart Shuffle: шесть силуэтов солдат в двух группах по три над словами SQUAD и SMART SHUFFLE, соединёнными двумя стрелками обмена">
</picture>

# Squad-SmartShuffle

**Умное перемешивание команд для серверов Squad. В конце раунда оценивает каждого игрока только по этому матчу, делит команды поровну и на один раунд запрещает смену команды.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-A78BFA?style=for-the-badge&logo=gnu&logoColor=white)](./LICENSE)
[![Version](https://img.shields.io/github/v/release/Miabeyefendi/Squad-SmartShuffle?style=for-the-badge&color=F59E0B&label=version)](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest)
[![Platform](https://img.shields.io/badge/SquadJS_%7C_ModLoader-1E293B?style=for-the-badge&logo=nodedotjs&logoColor=white)](#-установка)
[![Status](https://img.shields.io/badge/status-active-22C55E?style=for-the-badge)](#)
[![Author](https://img.shields.io/badge/by-Miabeyefendi-0EA5E9?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Miabeyefendi)

[English](./README.md) · [Türkçe](./README_TR.md) · [Español](./README_ES.md) · [简体中文](./README_ZH.md) · **Русский**

[Установка](#-установка) · [Возможности](#-главное) · [Использование](#-быстрый-старт) · [Изменения](./CHANGELOG.md)

<a href="https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest">
  <img src="./assets/btn-download.svg" height="52" alt="Скачать последнюю версию">
</a>
<a href="./CHANGELOG.md">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/btn-changelog-dark.svg">
    <img src="./assets/btn-changelog.svg" height="52" alt="Открыть список изменений">
  </picture>
</a>

</div>

---

## ✨ Главное

- **Оценивает игроков, а не команды** - убийства, ранения, смерти, урон, поднятия и установленные постройки в минуту, со сглаживанием для тех, кто играл недолго
- **Только этот матч** - ни базы данных, ни истории рейтинга, ни сохранённых Steam ID; каждый раунд начинается с нуля
- **Хороший во всём сильнее хорошего в одном** - взвешенное среднее геометрическое, поэтому фармер убийств не обгонит разностороннего игрока
- **Баланс по каждой оси** - кроме общей силы поровну делятся темп убийств, урон, смерти, поднятия, строительство и киты (медик, экипаж техники)
- **Командиры отрядов делятся по группам** - SL техники, маленькие закрытые отряды и открытые отряды делятся отдельно
- **Друзья остаются вместе** - режим блокировки 2 держит каждую party на одной стороне
- **Блокировка на один раунд** - после перемешивания сменившего команду (или перезашедшего ради этого) возвращают обратно до конца раунда
- **Три варианта** - плагин SquadJS для серверов без модов, гибрид с маленьким рулсетом ModLoader для полной таблицы счёта и чистый Blueprint для ModLoader

---

## 📦 Установка

### Требования

| Вариант | Нужно | Сервер остаётся без модов |
|---|---|---|
| SquadJS | [SquadJS](https://github.com/Team-Silver-Sphere/SquadJS) 4.x на сервере | Да, игроки ничего не скачивают |
| Гибрид | SquadJS + [ModLoader](https://steamcommunity.com/sharedfiles/filedetails/?id=3516838562) + рулсет выгрузки | Нет, сервер с модами |
| ModLoader | ModLoader + рулсет на Blueprint | Нет, сервер с модами |

### Сделано на

![JavaScript](https://img.shields.io/badge/JavaScript-1E293B?style=for-the-badge&logo=javascript&logoColor=A78BFA)
![Node.js](https://img.shields.io/badge/Node.js-1E293B?style=for-the-badge&logo=nodedotjs&logoColor=A78BFA)
![Unreal Engine](https://img.shields.io/badge/Unreal_Engine-1E293B?style=for-the-badge&logo=unrealengine&logoColor=A78BFA)

### Вариант SquadJS

1. Скачайте `smart-shuffle.js` из [последнего релиза SquadJS](https://github.com/Miabeyefendi/Squad-SmartShuffle/releases/latest).
2. Скопируйте его в `SquadJS/squad-server/plugins/`.
3. Добавьте плагин в список `plugins` в `config.json`:

```json
{
  "plugin": "SmartShuffle",
  "enabled": true,
  "autoShuffle": false,
  "lockMode": 2
}
```

4. Перезапустите SquadJS.

<details>
<summary><b>Гибридный вариант (полная таблица счёта)</b></summary>

1. Установите вариант SquadJS выше и задайте `"useScoreboardDump": true`.
2. Установите на сервер [ModLoader](https://steamcommunity.com/sharedfiles/filedetails/?id=3516838562) и [элемент SmartShuffle из Мастерской](https://steamcommunity.com/sharedfiles/filedetails/?id=3835528773) (ID 3835528773).
3. Добавьте `/SmartShuffle/BP_SmartShuffleDump.BP_SmartShuffleDump_C` в список `rulesets` в `Saved/ModLoader/ModLoader.json`. Сам Blueprint описан в [`src/hybrid/BP_SmartShuffleDump.md`](./src/hybrid/BP_SmartShuffleDump.md).

Если строки выгрузки не приходят, плагин сам возвращается к данным SquadJS.

</details>

<details>
<summary><b>Вариант ModLoader (без SquadJS)</b></summary>

Соберите `BP_SmartShuffle` в Squad SDK по [`src/modloader/BP_SmartShuffle.md`](./src/modloader/BP_SmartShuffle.md)
и зарегистрируйте его в `Saved/ModLoader/ModLoader.json`. У каждой функции Blueprint есть проверенный аналог с тем же
именем в `smart-shuffle.js`.

</details>

---

## 🚀 Быстрый старт

Введите в **админ-чате** игры:

```
!smartshuffle now        перемешать один раз в конце этого раунда
!smartshuffle preview    показать, что сделало бы перемешивание сейчас, никого не двигает
!smartshuffle auto on    перемешивать в конце каждого раунда
!smartshuffle lock 2     блокировать после перемешивания и держать друзей вместе
!smartshuffle unlock     снять блокировку до конца этого раунда
!smartshuffle status     показать текущие настройки
```

В конце раунда плагин переводит игроков через `AdminForceTeamChange`, объявляет, сколько человек переведено, и держит
новые команды до конца следующего раунда.

---

## 🧮 Как это работает

1. **Сбор.** Во время матча для каждого игрока считаются убийства, ранения, смерти, урон, поднятия, установленные
   постройки, тимкиллы и сыгранные минуты. Новая карта всё обнуляет.
2. **Оценка.** Каждая статистика превращается в темп в минуту, подтянутый к среднему по матчу (априорные 30 минут),
   затем в z-оценку, сжатую в диапазон 0..1: наполовину относительно всего сервера, наполовину внутри своей команды.
   Четыре категории (KDA, Бой, Командная работа, Цели) объединяются взвешенным средним геометрическим, с отдельными
   весами для командиров отрядов, медиков и игроков поддержки. Каждый тимкилл снижает оценку на 10%.
3. **Деление.** Сначала по группам делятся командиры отрядов. Остальные по очереди идут в более слабую команду, затем
   парные обмены одновременно сокращают разрыв в общей силе и в каждом дополнительном измерении.
4. **Блокировка.** Режим 1 держит всех на новой стороне один раунд. Режим 2 сначала переводит каждую party на одну
   сторону, затем держит её там.

В симуляции на 100 игроков с матчами на тикетах доля разгромов (разница больше 150 тикетов) снизилась с 26% при
случайном перемешивании до 10.4% с формулой SquadJS и до 9.3% с полной таблицей счёта (гибрид).

---

## ⚙️ Настройка

Все параметры задаются в записи плагина в `config.json` SquadJS.

| Ключ | По умолчанию | Что делает |
|---|---|---|
| `command` | `smartshuffle` | Имя команды админ-чата |
| `autoShuffle` | `false` | Перемешивать в конце каждого раунда |
| `lockMode` | `2` | 0 без блокировки, 1 жёсткая, 2 блокировка, сохраняющая party вместе |
| `kitMedic` | `Medic` | Regex по имени роли для китов медика |
| `kitLogistics` | пусто | Regex для класса логистики, пусто значит не используется |
| `kitCrew` | `Crewman\|Pilot` | Regex для китов экипажа; SL экипажей образуют свою группу |
| `lockedSquadMaxSize` | `3` | Закрытый отряд до такого размера считается отрядом друзей |
| `maxPartySize` | `4` | Режим блокировки 2: party до этого размера остаётся вместе, большая делится. 0 означает без ограничения |
| `skipLayers` | `["seed", "jensen", "invasion"]` | Автоматическое перемешивание пропускает раунд, если название layer содержит что-то из списка. `!smartshuffle now` выполняется всегда |
| `minPlayers` | `40` | Автоматическое перемешивание пропускает раунд с меньшим числом игроков. `!smartshuffle now` выполняется всегда |
| `useScoreboardDump` | `false` | Гибрид: читать полную таблицу счёта из лога сервера |
| `dumpWaitSeconds` | `10` | Гибрид: сколько ждать выгрузку в конце раунда |

---

## 📖 Документация

- [**Рецепт Blueprint для гибрида**](./src/hybrid/BP_SmartShuffleDump.md) - рулсет выгрузки и формат лога
- [**Рецепт Blueprint для ModLoader**](./src/modloader/BP_SmartShuffle.md) - полная версия внутри игры
- [**Список изменений**](./CHANGELOG.md) - что изменилось в каждом релизе
- [**Участие**](./CONTRIBUTING.md) - как отправить изменение
- [**Безопасность**](./SECURITY.md) - как сообщить об уязвимости приватно

Тесты: `node --test tests/squadjs/core.test.mjs`. Они сверяют оценки и команды с эталонной моделью и запускают
плагин на имитации сервера SquadJS.

---

## 🧭 Планы

- [ ] Запустить плагин SquadJS на живом сервере и проверить формат party в `ListPlayers`
- [x] Собрать рулсет выгрузки для гибрида и опубликовать его в Мастерской
- [ ] Собрать Blueprint для ModLoader

Здесь нет обещаний. Это личный проект, и список меняется вместе с моими
приоритетами.

---

## ❓ Частые вопросы

<details>
<summary><b>Чем это отличается от встроенного перемешивания?</b></summary>

`!randomize` перемешивает случайно, и сильные игроки всё равно могут оказаться вместе. Этот плагин оценивает каждого
игрока по только что завершённому матчу и делит команды так, чтобы общая сила и каждый вид вклада были равны.

</details>

<details>
<summary><b>Хранит ли он историю игроков?</b></summary>

Нет. Он использует только что завершённый матч и забывает его при загрузке следующей карты. На диск ничего не пишется.

</details>

<details>
<summary><b>Нужно ли игрокам что-то скачивать?</b></summary>

В варианте SquadJS нет: плагин работает рядом с сервером, сервер остаётся без модов. Гибрид и ModLoader требуют ModLoader,
который игроки скачивают автоматически при входе, а сервер отображается как модифицированный.

</details>

<details>
<summary><b>Могут ли зайти игроки из Epic Games?</b></summary>

В варианте SquadJS сервер не меняется, поэтому все, кто может зайти сегодня, смогут и дальше. Версия Squad в Epic Games
не поддерживает моды, поэтому гибрид и ModLoader рассчитаны на игроков Steam.

</details>

---

## 🤝 Участие

Вклад приветствуется. Сначала прочитайте [CONTRIBUTING.md](./CONTRIBUTING.md) и
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Внося вклад, вы соглашаетесь
лицензировать свою работу под AGPL-3.0.

<div align="center">
<a href="https://github.com/Miabeyefendi/Squad-SmartShuffle/issues/new?template=bug_report.yml">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/btn-report-bug-dark.svg">
    <img src="./assets/btn-report-bug.svg" height="52" alt="Сообщить об ошибке">
  </picture>
</a>
<a href="https://github.com/Miabeyefendi/Squad-SmartShuffle/stargazers">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/btn-star-dark.svg">
    <img src="./assets/btn-star.svg" height="52" alt="Поставить звезду репозиторию">
  </picture>
</a>
</div>

---

## 🙏 Благодарности

- [**SquadJS**](https://github.com/Team-Silver-Sphere/SquadJS) от Team Silver Sphere - среда, в которой работает
  плагин. Он использует её события лога, RCON и `BasePlugin`, а перевод игроков повторяет стандартный `TeamRandomizer`.
- [**ModLoader**](https://steamcommunity.com/sharedfiles/filedetails/?id=3516838562) от Jhett - загружает рулсеты
  на ванильных слоях. [SquadJSLogger](https://steamcommunity.com/sharedfiles/filedetails/?id=3586951441) того же
  автора показал, что рулсет может писать в лог сервера, и на этом построен гибридный вариант.

---

## 🛡️ Безопасность

Нашли уязвимость? Не открывайте публичный issue. Следуйте приватной процедуре из
[SECURITY.md](./SECURITY.md).

---

## 📜 Лицензия

Проект распространяется под **GNU Affero General Public License v3.0
(AGPL-3.0)** вместе с дополнительными условиями из файла [NOTICE](./NOTICE).
Коротко:

- Вы можете бесплатно использовать, изучать, изменять, распространять и даже
  зарабатывать на этой работе, **при условии** что вы сохраняете полный исходный
  код доступным под AGPL-3.0, включая любое размещённое, SaaS или сетевое
  использование (AGPL, раздел 13), и сохраняете указанную ниже атрибуцию автора.
- Для использования в закрытом или проприетарном продукте, а также для запуска в
  виде закрытого SaaS требуется **отдельная письменная коммерческая лицензия**,
  которая может включать роялти или долю дохода. См. [NOTICE](./NOTICE),
  раздел 8, и свяжитесь со мной.

### Атрибуция (обязательна)

Согласно разделу 7(b) AGPL-3.0, следующая атрибуция должна сохраняться на
видном месте и без изменений в любой копии, форке или развёртывании проекта:

> **Miabeyefendi (Mustafa Ihsan Albayrak)** - https://github.com/Miabeyefendi

### Отказ от ответственности

Программа предоставляется «как есть», без каких-либо гарантий. Вы запускаете её
целиком на свой страх и риск и несёте единоличную ответственность за собственное
использование, включая соблюдение условий обслуживания любой сторонней
платформы, с которой она взаимодействует. Эти платформы не связаны с автором и
не одобряют его работу; их названия и товарные знаки принадлежат их владельцам.
Автор не несёт ответственности за блокировки аккаунтов, потерю данных и любой
другой ущерб в максимальной степени, допустимой применимым правом. Полные
условия в файлах [LICENSE](./LICENSE) и [NOTICE](./NOTICE).

---

## 📬 Контакты

- GitHub: [@miabeyefendi](https://github.com/Miabeyefendi)
- По вопросам коммерческого лицензирования или разделения дохода пишите через мой
  профиль GitHub.

<div align="center">
<br/>
<img src="./assets/divider.svg" width="100%" height="3" alt="">
<br/>
<sub>Сделано <b><a href="https://github.com/Miabeyefendi">Miabeyefendi</a></b></sub>
</div>
