# code
Implementation of QOI (Quite OK Image) Format in JavaScript

For more on QOI:
https://github.com/phoboslab/qoi
https://qoiformat.org/


My article about image compression and an explanation of QOI:
https://medium.com/@mkhilev/fundamentals-of-image-compression-f357707a9d12

This is a zero-dependency implementation with additional functions helpful to practical use in JS.



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Saving an image from the internet in .qoi:

let u = await URLtoCanvas("https://my.url");
// returns object {canvas,context,width,height,channels,colorspace}

let f = bufferFromCanvas(u.canvas,u.context);
// using this method will result in 4 channels for both the ArrayBuffer and u.channels

let e = qoiEncode(f,u);
// encoder needs buffer ('f') and a description object with {width,height,channels,colorspace} which we already have in 'u'

writeArrayBufferToFile(e);
// opens Windows Save As, save it preferably with a .qoi extension
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Drawing an image in the browser from a .qoi file:

let a = await fetchArrayBufferFromFile();
// select a .qoi file when prompted

let d = {};
let t = qoiDecode(a,d,0);
// 'd' will be populated now

let c = canvasFromBuffer(t,d.width,d.height,d.channels);

document.body.appendChild(c);
// assumes blank html page with relevant .js connected
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



Disclaimer: Some counterparts of the same exampe image included in the original QOI repository may not have been encoded correctly, leading to areBuffersEqual() returning 'false'

MIT License

Copyright (c) 2024 Mykhaylo Levchenko

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.