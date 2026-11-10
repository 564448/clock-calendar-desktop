// Draws one line of text in a font and saves it as a PNG.
// Run in its own process (gjs -m renderPreview.js out.png family size r g b text):
// a fresh process sees fonts installed a moment ago, the preferences window does not.
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';
import cairo from 'gi://cairo';

const [out, family, size, r, g, b, text] = ARGV;
const font = Pango.FontDescription.from_string(`${family} ${size}`);

const measure = new cairo.Context(new cairo.ImageSurface(cairo.Format.ARGB32, 1, 1));
const probe = PangoCairo.create_layout(measure);
probe.set_font_description(font);
probe.set_text(text, -1);
const [w, h] = probe.get_pixel_size();

const image = new cairo.ImageSurface(cairo.Format.ARGB32, w + 4, h + 4);
const cr = new cairo.Context(image);
cr.setSourceRGBA(Number(r), Number(g), Number(b), 1);
cr.moveTo(2, 2);
const layout = PangoCairo.create_layout(cr);
layout.set_font_description(font);
layout.set_text(text, -1);
PangoCairo.show_layout(cr, layout);
image.writeToPNG(out);
