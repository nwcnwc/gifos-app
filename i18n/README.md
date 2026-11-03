# GifOS message catalogs

GifOS's own words, one JSON file per surface per language. English (`en`) is
the base: every key exists in `en` first, and every other language translates
it. A key a language has not translated yet reads in English.

```
i18n/
  en/
    common.json          shared words for formatters (sizes, durations, "5m ago")
    settings.json        Settings
    desktop.json         the Home Screen            (one file per surface)
    apps/notes.json      a built-in app's own words (one file per app)
  es/
    settings.json        the same files, translated
```

## Keys

- A surface file's keys start with the file name: `settings.json` holds
  `settings.lang.title`, `settings.lang.intro`, … The part after the surface
  names the place, then the thing: `settings.lang.reset`, `desktop.menu.arrange`.
- A built-in app's file (`apps/<appId>.json`) uses plain keys (`add`,
  `search.placeholder`): the app reads only its own file.
- Keys never change meaning. If the English changes meaning, it is a new key.

## Messages

Each value is an ICU MessageFormat string:

```json
{
  "settings.lang.auto": "Automatic ({name})",
  "desktop.trash.count": "{n, plural, =0 {Trash is empty} one {# item in Trash} other {# items in Trash}}",
  "desktop.place": "{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
}
```

Plural categories (`zero`, `one`, `two`, `few`, `many`, `other`) are the
language's own, from `Intl.PluralRules`: Russian uses `one`, `few`, `many`
and `other`; Chinese and Japanese use only `other`. `other` is required. `#`
is the number, written in the reader's locale. Write `'{'` for a literal brace
and `''` for an apostrophe next to one. A translation may use only the
arguments the English uses.

## Adding a language

1. Make `i18n/<tag>/` with the same files as `i18n/en/`, translated. `<tag>`
   is a BCP 47 language tag, with a script where the language has more than
   one: `es`, `ru`, `zh-Hans`, `zh-Hant`, `pt-BR`.
2. Add `<tag>` to `LOCALES` at the top of `js/gifos-i18n.js`.

A reader whose locale is `es-MX` reads `es-MX` if it exists, then `es`, then
`en`; `zh-TW` reads `zh-Hant`, then `en`.

## In code

```js
await GifOS.i18n.load('settings');          // before the surface paints
GifOS.i18n.t('settings.lang.title');         // "Language and region"
GifOS.i18n.t('desktop.trash.count', { n });  // plurals in the reader's language
GifOS.i18n.fmt.date(ts, { month: 'short', day: 'numeric' });
GifOS.i18n.fmt.fileSize(bytes);              // 3.4 MB, 3,4 MB
GifOS.i18n.onChange(repaint);                // the person chose another language
```

Words follow the interface language; numbers, dates and times follow the full
locale (language, region and the 12/24-hour choice). Apps get the same locale
through `gifos.locale()`; see "LANGUAGE AND REGION" in `/llms.txt`.
