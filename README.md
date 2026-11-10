# Clock&Calendar Desktop

A GNOME Shell extension that puts a clock and a calendar on the desktop. Each
one is its own card with its own settings, sits above the wallpaper and below
every window, and can be placed anywhere by dragging.

- **Clock**: a time line and a date line. You write each line yourself with
  date and time codes (for example `%H:%M:%S`), or leave it empty to hide it.
- **Calendar**: month grid, current-week strip, or a big day number
  (Minimal). Headings and weekday names are written with the same codes.
- **Fonts**: pick any installed font, or browse free Google Fonts (OFL, Apache
  and Ubuntu licenses) and install them from the preferences. A preview line
  shows the font with text you type.
- **Look**: text size and color, card opacity, corner radius and padding.
- **Position**: Move mode floats the cards above everything so you can drag
  them; the position is stored as a fraction of the primary monitor.

## Requirements

- GNOME Shell 50 on Wayland (`metadata.json` lists only `50`)
- `gjs` and `fontconfig` (`fc-cache`), which come with GNOME
- Network access only for the font browser (see below)

## Install

The folder name must match the extension UUID:

```sh
git clone https://github.com/564448/clock-calendar-desktop \
  ~/.local/share/gnome-shell/extensions/triland-clock@knight.local
cd ~/.local/share/gnome-shell/extensions/triland-clock@knight.local
glib-compile-schemas schemas
```

Log out and in (a new extension is only picked up at login on Wayland), then:

```sh
gnome-extensions enable triland-clock@knight.local
gnome-extensions prefs triland-clock@knight.local
```

The UUID still says `triland-clock` because the extension started under that
name.

## Date and time codes

Each text field takes the codes of
[GLib `DateTime.format`](https://docs.gtk.org/glib/method.DateTime.format.html):

| Code | Meaning | Code | Meaning |
|---|---|---|---|
| `%H` | hour 00-23 | `%A` / `%a` | weekday / short weekday |
| `%I` | hour 01-12 | `%B` / `%b` | month / short month |
| `%M` | minute | `%-d` | day without leading zero |
| `%S` | second | `%Y` | year |
| `%p` | AM/PM | | |

An empty field hides that line. A code GLib does not know is shown as typed.
Names follow your system locale.

## Fonts

The Fonts page lists Google Fonts (from the Fontsource list) and installs the
full TTF files from the `google/fonts` repository into
`~/.local/share/fonts/triland-calendar/<font>`, then runs `fc-cache`, so every
app can use them. Remove deletes them again. The folder keeps its old name so
fonts installed by the earlier Triland Calendar extension still count as
installed. Only the font browser uses the network:
`api.fontsource.org`, `api.github.com` and `raw.githubusercontent.com`.
The font list is cached for 24 hours in `~/.cache/triland-calendar/`.

## Known limits

- Checked on one machine only (GNOME Shell 50.1, Wayland, fractional scale
  1.25), mostly in nested headless sessions. The Install, Use and Remove
  buttons and Move mode have not been tried on a real session.
- A font must be installed before its preview shows; the preview is drawn by a
  separate process because the preferences window does not see fonts installed
  after it opened. Preview text has slight color fringes.
- Move mode and desktop icons (DING) were not tested together.
- Only the primary monitor is used.

## License

MIT, see [LICENSE](LICENSE). Fonts you install belong to their authors and keep
their own licenses.
