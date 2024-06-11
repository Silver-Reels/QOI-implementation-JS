function qoiEncode(dataBuffer,desc){                    // ArrayBuffer, {width,height,channels,colorspace}
    let data=new Uint8Array(dataBuffer);
    let QOI_PIXELS_MAX=400000000;
    let QOI_MAGIC="qoif";
    let QOI_HEADER_SIZE=14;
    let qoi_padding=new Uint8Array([0,0,0,0,0,0,0,1]);  // end marker

    let QOI_OP_RUN=   0b11000000;                       // 11xxxxxx
    let RUN_BIAS=     1;
    let RUN_MAX=      0b00111101 + RUN_BIAS;

    let QOI_OP_INDEX= 0b00000000;                       // 00xxxxxx

    let QOI_OP_DIFF=  0b01000000;                       // 01xxxxxx
    let DIFF_BIAS=    2;

    let QOI_OP_LUMA=  0b10000000;                       // 10xxxxxx
    let LUMA_G_BIAS=  32;
    let LUMA_RB_BIAS= 8;

    let QOI_OP_RGB=   0b11111110;                       // 11111110
    let QOI_OP_RGBA=  0b11111111;                       // 11111111

    let sameAsLastPixel=false;                          // QOI_OP_RUN condition
    let run=0;                                          // how many pixels to QOI_OP_RUN

    let vr=0;let vg=0;let vb=0;let vg_r=0;let vg_b=0;   // variables for QOI_OP_DIFF and QOI_OP_LUMA math

    let index=[];   for (let i=0;i<64;i++){index.push(new Uint8Array(4))};  // cache
    let index_pos=0;
    let sameInIndex=false;

    let px=     new Uint8Array([0,0,0,255]);            // current pixel being checked
    let px_prev=new Uint8Array([0,0,0,255]);            // last pixel recorded being checked

    if (data==null||desc==null||desc.width==0||desc.height==0||desc.channels<3||desc.channels>4||desc.colorspace>1
        ||desc.height>=QOI_PIXELS_MAX/desc.width){
        return null;                                    // basic data validation
    };
    let channels=desc.channels;

    let max_size=desc.width*desc.height*(channels+1)+QOI_HEADER_SIZE+qoi_padding.length;
    let byte=new Uint8Array(max_size);                  // final output
    let p=0;

    byte[p++] = QOI_MAGIC.charCodeAt(0);                // "qoif"
    byte[p++] = QOI_MAGIC.charCodeAt(1);
    byte[p++] = QOI_MAGIC.charCodeAt(2);
    byte[p++] = QOI_MAGIC.charCodeAt(3);

    byte[p++] = (0xFF000000&desc.width)>>>24;           // take int value from desc.width
    byte[p++] = (0x00FF0000&desc.width)>>>16;           // encode it in 4 bytes (4 Uint8Array items)
    byte[p++] = (0x0000FF00&desc.width)>>>8;            // with bitwise operations
    byte[p++] = (0x000000FF&desc.width);
    
    byte[p++] = (0xFF000000&desc.height)>>>24;          // same for height
    byte[p++] = (0x00FF0000&desc.height)>>>16;
    byte[p++] = (0x0000FF00&desc.height)>>>8;
    byte[p++] = (0x000000FF&desc.height);

    byte[p++] = channels;                               // channels and colorspace
    byte[p++] = desc.colorspace;

    let px_len=desc.width*desc.height*channels;         // iterators for loop
    let px_end=px_len-channels;
    let px_pos=0;


    for (px_pos=0;px_pos<px_len;px_pos+=channels){      // loop of encoding pixel data
        px[0]=data[px_pos];
        px[1]=data[px_pos+1];                           // updating current pixel values
        px[2]=data[px_pos+2];
        if (channels==4){px[3]=data[px_pos+3]};

        sameAsLastPixel=(px[0]===px_prev[0] && px[1]===px_prev[1] && px[2]===px_prev[2] && px[3]===px_prev[3]);

        if (sameAsLastPixel){
            run++;
            if (run===RUN_MAX||px_pos===px_end){
                byte[p++]=QOI_OP_RUN|(run-RUN_BIAS);    // encode QOI_OP_RUN
                run=0;
            };
            continue;
        };

        if (run>0){
            byte[p++]=QOI_OP_RUN|(run-RUN_BIAS);        // continue encoding QOI_OP_RUN
            run=0;
        };

        index_pos=((px[0]*3)+(px[1]*5)+(px[2]*7)+(px[3]*11))%64;
        sameInIndex=(index[index_pos][0]===px[0] && index[index_pos][1]===px[1]     // checking if current pixel is in cache
                     && index[index_pos][2]===px[2] && index[index_pos][3]===px[3]);

        if (sameInIndex){
            byte[p++]=QOI_OP_INDEX|index_pos;           // encode QOI_OP_INDEX
        }
        else{
            index[index_pos][0]=px[0];
            index[index_pos][1]=px[1];                  // adding current pixel to cache
            index[index_pos][2]=px[2];
            index[index_pos][3]=px[3];

            if (px[3]===px_prev[3]){                    // same alpha value

                // gets shortest distence from last value to current value, in domain [-128,+127]
                // done this way so as to be able to encode wraparound differences
                vr=px[0]-px_prev[0];
                if (vr<-128||(vr>=0 && vr<128)){vr+=256}else{vr-=256};vr%=256;
                vg=px[1]-px_prev[1];
                if (vg<-128||(vg>=0 && vg<128)){vg+=256}else{vg-=256};vg%=256;
                vb=px[2]-px_prev[2];
                if (vb<-128||(vb>=0 && vb<128)){vb+=256}else{vb-=256};vb%=256;
                gtor=vr-vg; // (current R - last R) expressed in its own distance from (current G - last G)
                gtob=vb-vg; // same, but with B

                if (vr>-3&&vr<2&&vg>-3&&vg<2&&vb>-3&&vb<2){
                    byte[p++]=QOI_OP_DIFF|((vr+DIFF_BIAS)<<4)|((vg+DIFF_BIAS)<<2)|(vb+DIFF_BIAS);   // encode QOI_OP_DIFF
                }
                else if (gtor>-9&&gtor<8&&vg>-33&&vg<32&&gtob>-9&&gtob<8){
                    byte[p++]=QOI_OP_LUMA|(vg+LUMA_G_BIAS);                                         // encode QOI_OP_LUMA
                    byte[p++]=((gtor+LUMA_RB_BIAS)<<4)|(gtob+LUMA_RB_BIAS);
                }
                else {
                    byte[p++]=QOI_OP_RGB;               // encode QOI_OP_RGB
                    byte[p++]=px[0];
                    byte[p++]=px[1];
                    byte[p++]=px[2];
                }
            }
            else {
                byte[p++]=QOI_OP_RGBA;                  // encode QOI_OP_RGBA
                byte[p++]=px[0];
                byte[p++]=px[1];
                byte[p++]=px[2];
                byte[p++]=px[3];
            };
        };
        px_prev[0]=px[0];                               // updating value of what
        px_prev[1]=px[1];                               // the "previous pixel" will
        px_prev[2]=px[2];                               // be known as. code always reaches here
        px_prev[3]=px[3];                               // except for when executing QOI_OP_RUN (unnecessary)
    };
    // chunk loop over
    for (let i=0;i<qoi_padding.length;i++){byte[p++]=qoi_padding[i]};  // adding end-markers
    byte=byte.slice(0,p);                               // making data the shortest it's meant to be
    return byte.buffer;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function qoiDecode(dataBuffer,desc,channels=0){         // buffer, desc{empty}, int
    let data=new Uint8Array(dataBuffer);                // encoded data to decode
    let index=[];   for (let i=0;i<64;i++){index.push(new Uint8Array(4))};  // cache
    
    let px=new Uint8Array([0,0,0,255]);                 // current pixel value we will repeatedly discover
    let px_pos; let px_len;
    let chunks_len;
    let p=0;    let run=0;

    let QOI_PIXELS_MAX=400000000;
    let QOI_HEADER_SIZE=14;
    let QOI_MAGIC=1903126886;                           // "qoif" in binary (4 bytes) to decimal, used for comparison
    let qoi_padding=new Uint8Array([0,0,0,0,0,0,0,1]);  // end marker

    let QOI_OP_RUN=  0b11000000;                        // 11xxxxxx

    let QOI_OP_INDEX=0b00000000;                        // 00xxxxxx

    let QOI_OP_DIFF= 0b01000000;                        // 01xxxxxx
    let DIFF_BIAS=2;

    let QOI_OP_LUMA= 0b10000000;                        // 10xxxxxx
    let LUMA_G_BIAS=  32;
    let LUMA_RB_BIAS= 8;

    let QOI_OP_RGB=  0b11111110;                        // 11111110
    let QOI_OP_RGBA= 0b11111111;                        // 11111111

    let QOI_MASK_2=  0b11000000;                        // 11xxxxxx, bitmask for checking only first 2 bits

    if (data==null||desc==null||(channels!=0 && channels!=3 && channels!=4)
        ||data.length<QOI_HEADER_SIZE+qoi_padding.length){
        return null;                                    // basic validation 1
    }
    let header_magic=(data[p++]<<24|data[p++]<<16|data[p++]<<8|data[p++]);
    desc.width=  (data[p++]<<24|data[p++]<<16|data[p++]<<8|data[p++]);
    desc.height= (data[p++]<<24|data[p++]<<16|data[p++]<<8|data[p++]);
    desc.channels=data[p++];                            // we expect an empty 'desc' object we'll build
    desc.colorspace=data[p++];                          // the metadata on as a 'side-effect'

    if (desc.width==0||desc.height==0||desc.channels<3||desc.channels>4||desc.colorspace>1
        ||header_magic!=QOI_MAGIC||desc.height>=QOI_PIXELS_MAX/desc.width){
        return null;                                    // basic validation 2
    };

    if (channels==0){channels=desc.channels};

    px_len=desc.width*desc.height*channels;
    let pixels=new Uint8Array(px_len);                  // the output
    chunks_len=data.length-qoi_padding.length;


    for (px_pos=0;px_pos<px_len;px_pos+=channels){

        if (run>0){run--;                               // if QOI_OP_RUN is in progress, skip to end of loop
        }
        else if (p<chunks_len){
            let b1=data[p++];                           // read first byte

            if (b1===QOI_OP_RGB){                       // encountered QOI_OP_RGB instruction
                px[0]=data[p++];
                px[1]=data[p++];
                px[2]=data[p++];
            }
            else if (b1===QOI_OP_RGBA){                 // encountered QOI_OP_RGB instruction
                px[0]=data[p++];
                px[1]=data[p++];
                px[2]=data[p++];
                px[3]=data[p++];
            }
            else if ((b1&QOI_MASK_2)===QOI_OP_INDEX){   // encountered QOI_OP_INDEX instruction
                px[0]=index[b1][0];
                px[1]=index[b1][1];                     // gets pixel values from cache
                px[2]=index[b1][2];
                px[3]=index[b1][3];
            }
            else if ((b1&QOI_MASK_2)===QOI_OP_DIFF){    // encountered QOI_OP_DIFF instruction
                px[0]+=((b1>>>4)&0b11)-DIFF_BIAS;
                px[1]+=((b1>>>2)&0b11)-DIFF_BIAS;       // gets pixel values from encoded differences
                px[2]+=((b1   ) &0b11)-DIFF_BIAS;
            }
            else if ((b1&QOI_MASK_2)===QOI_OP_LUMA){    // encountered QOI_OP_LUMA instruction
                let b2=data[p++];
                let vg=(b1&0b00111111)-LUMA_G_BIAS;     // green difference found in the last 6 bits of byte 1
                px[0]+=vg+((b2>>>4)&0x0F)-LUMA_RB_BIAS; // calculates red difference, then applies it
                px[1]+=vg;                              // applies green difference
                px[2]+=vg+(b2&0x0F)-LUMA_RB_BIAS;       // calculates blue difference, then applies it
            }
            else if ((b1&QOI_MASK_2)===QOI_OP_RUN){     // activates QOI_OP_RUN, making loop cycles skip to end,
                run=(b1&0b00111111);                    // as the pixel values are known
            };
            let hash=((px[0]*3)+(px[1]*5)+(px[2]*7)+(px[3]*11))%64; // hashing

            index[hash][0]=px[0];
            index[hash][1]=px[1];                       // updating cache with current pixel
            index[hash][2]=px[2];
            index[hash][3]=px[3];
        };

        pixels[px_pos  ]=px[0];                         // updating the output now that we know
        pixels[px_pos+1]=px[1];                         // the correct current pixel values
        pixels[px_pos+2]=px[2];
        if (channels===4){pixels[px_pos+3]=px[3]};
    };
    return pixels.buffer;
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// HELPER FUNCTIONS FOR JS USE

// opens Windows file picker and returns the buffer
async function fetchArrayBufferFromFile(){                  // using native File API
    let x=await window.showOpenFilePicker()
        .then(response=>response[0].getFile())
            .then(data=>data.arrayBuffer());
    return x;
};
// correct use: 'let buffer = await fetchArrayBufferFromFile()' , otherwise will return promise & not buffer
// after picking a file and the promise doing its thing, 'buffer' will reference the ArrayBuffer

// An ArrayBuffer cannot be manipulated directly,but an Uint8Array can be made from it:
// 'let array = new Uint8Array(buffer)' - the byte data can be manipulated from here
// to get an ArrayBuffer back from the Uint8Array: 'buffer = array.buffer'

async function writeArrayBufferToFile(ArrayBuffer){         // saves any array buffer as a file
    let space=await window.showSaveFilePicker()
        .then(response=>response.createWritable());

    await space.write(ArrayBuffer);
    await space.close();
    return;
};
// correct use: writeArrayBufferToFile(ArrayBuffer)
// opens Windows 'Save As' window; after you pick the path & name, it will save the file


function areBuffersEqual(ArrayBufferA,ArrayBufferB){
    let result={
        equalLength:true,
        firstDifference:-1
    };
    if (ArrayBufferA.byteLength!=ArrayBufferB.byteLength){result.equalLength=false;return result};
    let A=new Uint8Array(ArrayBufferA); let B=new Uint8Array(ArrayBufferB);
    for (let i=0;i<A.length;i++){if (A[i]!=B[i]){result.firstDifference=i;break;}};
    return result;
};

function testQOI(bufferEncoded){ // take QOI-encoded buffer
    let description={};
    
    let decoded=qoiDecode(bufferEncoded,description,0);
    let reEncoded=qoiEncode(decoded,description);   // description will be populated by the time this is called

    let equalityTest=areBuffersEqual(bufferEncoded,reEncoded);
    let equality=false;
    if (equalityTest.equalLength===true && equalityTest.firstDifference===-1){equality=true};

    let testObject={
        original:bufferEncoded,
        decoded:decoded,
        reEncoded:reEncoded,
        width:description.width,
        height:description.height,
        channels:description.channels,
        equalityTest:equalityTest,
        equalityConclusion:equality
    };
    return testObject;
};

function canvasFromBuffer(ArrayBufferDecoded,width,height,channels){
    let uint8=new Uint8Array(ArrayBufferDecoded);
    let canvas=document.createElement("canvas");                                    // <canvas> is the fastest way to render complex imagery in HTML
    canvas.width= width;canvas.height=height;
    let context=canvas.getContext("2d");                                            // initiates CanvasRenderingContext2D from native Canvas API
    context.imageSmoothingEnabled=false;

    let x=0;let y=0;

    for (let i=0;i<uint8.length;i+=channels){
        if (channels===3){context.fillStyle=`rgb(${uint8[i]}, ${uint8[i+1]}, ${uint8[i+2]})`};
        if (channels===4){context.fillStyle=`rgba(${uint8[i]}, ${uint8[i+1]}, ${uint8[i+2]}, ${uint8[i+3]})`};

        context.fillRect(x,y,1,1);
        x++;
        if (x===width){x=0;y++};
    };
    return canvas;
};
// quick way to visualize an image from a .qoi file:

/*
let a = await fetchArrayBufferFromFile();
let t = testQOI(a);
let c = canvasFromBuffer(t.decoded,t.width,t.height,t.channels);
document.body.appendChild(c);
*/

async function URLtoCanvas(url){    // works with internet (tested on localwebserver) and images in root dir
    let urlImg=document.createElement("img");
    urlImg.src= url;
    urlImg.crossOrigin="Anonymous";

    let canvas=document.createElement("canvas");
    let context=canvas.getContext("2d");

    let object={
        canvas:canvas,
        context:context,
        width:0,
        height:0,
        channels:4,
        colorspace:0
    };

    urlImg.onload=()=>{
        canvas.width= urlImg.naturalWidth;
        canvas.height=urlImg.naturalHeight;
        context.imageSmoothingEnabled=false;
        context.drawImage(urlImg,0,0);
        object.width=urlImg.naturalWidth;
        object.height=urlImg.naturalHeight;
    };

    return object;
};

function bufferFromCanvas(canvas,context){  // canvasAPI and that canvas' associated 'context'
    return (context.getImageData(0,0,canvas.width,canvas.height).data.buffer);  // will return 4 channel RGBA buffer
};

// quick way to save an image from a url to a .qoi file
/*
let u = await URLtoCanvas("https://my.url");
let f = bufferFromCanvas(u.canvas,u.context);
let e = qoiEncode(f,u);
writeArrayBufferToFile(e);
*/


// returns ImgElement aka <img> from HTMLCanvasElement aka <canvas>
function imgFromCanvas(canvas){
    
    let type="image/png";    // can be PNG, JPG or WEBP
    let quality=1;           // not for PNG; determines compression of JPG or WEBP. 0 = lowest, 1 = highest

    let base64=canvas.toDataURL(type,quality);

    let img=document.createElement("img");
    img.crossOrigin="Anonymous";
    img.src=base64;
    return img;
};



// for Node.js
// module.exports.qoiEncode=qoiEncode;
// module.exports.qoiDecode=qoiDecode;