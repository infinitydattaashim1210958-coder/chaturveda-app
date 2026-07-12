/**
 * app.js — Chaturveda Native App Controller
 *
 * Capacitor 6 + SQLite architecture
 *
 * Depends on:
 *   db.js        → window.VedaDB
 *   library.js   → window.VedaLibrary
 */


const APP_BUILD_VERSION = "v6.0-native-sqlite-2026-07-13";



const root = document.getElementById("app");
const backBtn = document.getElementById("backBtn");
const titleEl = document.getElementById("appTitle");
const searchBtn = document.getElementById("searchBtn");



const VEDA_THEME = {

    rigveda:{
        a:"#d4a24c",
        b:"#e8915c",
        tag:"Veda I · Knowledge"
    },

    yajurveda:{
        a:"#ff7a1a",
        b:"#e8b23d",
        tag:"Veda II · Ritual"
    },

    samaveda:{
        a:"#f2c464",
        b:"#ff7a1a",
        tag:"Veda III · Chant"
    },

    atharvaveda:{
        a:"#4f8c6b",
        b:"#c99a3e",
        tag:"Veda IV · Life"
    }

};



let vedaCache = {};

let appHistory = [];





/**
 * UI helpers
 */


function setTitle(text){

    if(titleEl)
        titleEl.textContent = text;

}



function showBack(show){

    if(backBtn)
        backBtn.style.visibility =
            show ? "visible" : "hidden";

}



function createElement(html){

    const template =
        document.createElement("template");

    template.innerHTML =
        html.trim();


    return template.content.firstChild;

}





async function ensureVedaCache(){


    if(Object.keys(vedaCache).length)
        return;


    const rows =
        await window.VedaDB.getVedas();



    rows.forEach(v=>{

        vedaCache[v.code]=v;

    });


}








/**
 * HOME SCREEN
 */


async function screenHome(){


    showBack(false);

    setTitle("চতুর্বেদ সংকলন");



    await ensureVedaCache();



    const cards =
        Object.values(vedaCache)
        .map(v=>{


            const theme =
                VEDA_THEME[v.code]
                ||
                {
                    a:"#d4a24c",
                    b:"#e8915c",
                    tag:""
                };



            return `

            <a class="card"
               href="#/veda/${v.code}"
               style="--a:${theme.a};--b:${theme.b}">


                <div class="tag">
                    ${theme.tag}
                </div>


                <h2>
                    ${v.name}
                </h2>


                <div class="arrow">
                    →
                </div>


            </a>

            `;


        })
        .join("");





    const libraryCard = `


    <a class="card"
       href="#/library"
       style="--a:#7fb0a8;--b:#4f8c6b">


        <div class="tag">
            Online
        </div>


        <h2>
            ডিজিটাল লাইব্রেরি
        </h2>


        <div class="arrow">
            →
        </div>


    </a>



    `;







    root.innerHTML = `


    <div class="hero">


        <div class="om">
            ॐ
        </div>


        <div class="sub">

        The Four Vedas —
        সম্পূর্ণ মন্ত্র সংকলন,
        ভাষ্য ও অনুবাদসহ

        </div>


    </div>



    <div class="grid">

        ${cards}

        ${libraryCard}

    </div>



    `;


}


/**
 * LIBRARY SCREEN
 */


async function screenLibrary(){


    showBack(true);

    setTitle("ডিজিটাল লাইব্রেরি");



    root.innerHTML = `

    <div class="loading"
         style="padding:60px 20px">

        বইয়ের তালিকা লোড হচ্ছে…

    </div>

    `;



    try{


        const [

            books,

            manifest

        ] = await Promise.all([


            window.VedaLibrary.fetchBlogBooks(),


            window.VedaLibrary.getManifest()


        ]);



        renderLibraryList(

            books,

            manifest

        );


    }

    catch(error){



        root.innerHTML = `

        <div class="empty">

        বই লোড করা যায়নি।

        <br><br>

        <small>
        ${error.message || error}
        </small>


        </div>

        `;



    }


}








function renderLibraryList(

    books,

    manifest

){



    if(!books.length){


        root.innerHTML = `

        <div class="empty">

        কোনো বই পাওয়া যায়নি।

        </div>

        `;


        return;


    }






    root.innerHTML = `


    <div class="listHeader">

        ${books.length}
        টি বই

    </div>




    <div class="libraryList">


    ${books.map(book=>{


        const downloaded =
            manifest[book.id];



        return `


        <div class="bookCard">


            <div class="bookInfo">


                <div class="bookTitle">

                    ${book.title}

                </div>



                <div class="bookMeta">

                    ${book.published || ""}

                </div>





                ${
                    downloaded

                    ?

                    `

                    <button
                    class="bookBtn openBtn"
                    data-id="${book.id}">

                    খুলুন

                    </button>


                    <button
                    class="bookBtn deleteBtn"
                    data-id="${book.id}">

                    মুছুন

                    </button>


                    `

                    :

                    `


                    <button
                    class="bookBtn downloadBtn"
                    data-id="${book.id}">

                    ডাউনলোড

                    </button>


                    `

                }




                <div
                class="bookStatus"
                data-status="${book.id}">

                </div>



            </div>



        </div>



        `;



    }).join("")}



    </div>



    `;






    const bookMap={};


    books.forEach(

        b=>bookMap[b.id]=b

    );





    root.querySelectorAll(".downloadBtn")

    .forEach(btn=>{


        btn.onclick = async()=>{


            const id =
                btn.dataset.id;



            const status =
                root.querySelector(
                `[data-status="${id}"]`
                );



            btn.disabled=true;

            btn.textContent="ডাউনলোড হচ্ছে…";



            try{


                await window.VedaLibrary.downloadBook(

                    bookMap[id],

                    msg=>{

                        if(status)
                            status.textContent=msg;

                    }

                );



                renderLibraryList(

                    books,

                    await window.VedaLibrary.getManifest()

                );


            }


            catch(e){


                btn.disabled=false;

                btn.textContent="ডাউনলোড";


                if(status)
                    status.textContent=e.message;


            }



        };


    });







    root.querySelectorAll(".openBtn")

    .forEach(btn=>{


        btn.onclick=()=>{


            location.hash =

            "#/library/read/" +

            btn.dataset.id;


        };


    });







    root.querySelectorAll(".deleteBtn")

    .forEach(btn=>{


        btn.onclick=async()=>{


            if(!confirm(

            "বইটি মুছে ফেলবেন?"

            ))

            return;



            await window.VedaLibrary.deleteBook(

                btn.dataset.id

            );



            renderLibraryList(

                books,

                await window.VedaLibrary.getManifest()

            );


        };


    });



}









async function screenLibraryReader(id){


    showBack(true);

    setTitle("বই পড়ুন");



    const manifest =

        await window.VedaLibrary.getManifest();



    const file =

        manifest[id];



    if(!file){


        root.innerHTML=

        `<div class="empty">
        বই ডাউনলোড করা নেই।
        </div>`;

        return;


    }



    const uri =

        await window.VedaLibrary.getFileUri(

            file.filename

        );



    const src =

        window.Capacitor.convertFileSrc(uri);





    root.innerHTML = `


    <iframe

    class="bookReaderFrame"

    src="${src}">

    </iframe>


    `;


}








/**
 * VEDA NAVIGATION
 */


async function screenVeda(code){


    await ensureVedaCache();



    const veda =

        vedaCache[code];



    if(!veda)

        return screenHome();




    showBack(true);

    setTitle(veda.name);



    const list =

        await window.VedaDB.getLevel1List(

            veda.id

        );




    root.innerHTML=`


    <div class="listHeader">

    ${veda.level1_label || "অধ্যায়"}

    </div>



    <div class="numGrid">


    ${list.map(x=>`


    <a class="numChip"

    href="#/veda/${code}/${x.level1}">

    ${x.level1}

    </a>


    `).join("")}



    </div>



    `;


}


/**
 * Level 1 screen
 */


async function screenLevel1(code, level1){


    await ensureVedaCache();


    const veda = vedaCache[code];


    if(!veda)

        return screenHome();



    showBack(true);



    setTitle(

        `${veda.level1_label || ""} ${level1}`

    );




    if(veda.level2_label){


        const list =

            await window.VedaDB.getLevel2List(

                veda.id,

                level1

            );



        root.innerHTML=`


        <div class="listHeader">

        ${veda.level2_label}

        </div>


        <div class="numGrid">


        ${list.map(x=>`


        <a class="numChip"

        href="#/veda/${code}/${level1}/${x.level2}">

        ${x.level2}

        </a>


        `).join("")}



        </div>


        `;



    }


    else{


        const mantras =

        await window.VedaDB.getMantraList(

            veda.id,

            level1,

            null

        );


        renderMantraList(

            veda,

            mantras

        );


    }



}








async function screenLevel2(

    code,

    level1,

    level2

){


    await ensureVedaCache();



    const veda = vedaCache[code];



    showBack(true);



    const mantras =

    await window.VedaDB.getMantraList(

        veda.id,

        level1,

        level2

    );



    renderMantraList(

        veda,

        mantras

    );



}







function renderMantraList(

    veda,

    mantras

){



    root.innerHTML=`


    <div class="listHeader">

    ${mantras.length}

    মন্ত্র

    </div>



    <div class="mantraList">


    ${mantras.map(m=>`


    <a class="mantraItem"

    href="#/mantra/${veda.code}/${encodeURIComponent(m.mantra_ref_id)}">


        <div class="mref">

        ${m.mantra_ref_id}

        </div>



        <div class="mtext">

        ${(m.sanskrit_swara ||
        m.sanskrit_text ||
        "").slice(0,80)}

        </div>


    </a>


    `).join("")}



    </div>



    `;


}









/**
 * Mantra detail screen
 */


async function screenMantra(

    code,

    refEncoded

){



    await ensureVedaCache();



    const veda =

        vedaCache[code];



    if(!veda)

        return screenHome();




    const ref =

        decodeURIComponent(

            refEncoded

        );




    showBack(true);



    setTitle(

        `${veda.name} ${ref}`

    );




    const mantra =

    await window.VedaDB.getMantraByRef(

        veda.id,

        ref

    );



    if(!mantra){


        root.innerHTML=

        `<div class="empty">

        মন্ত্র পাওয়া যায়নি।

        </div>`;


        return;


    }






    const scholars =

    await window.VedaDB.getScholarsForMantra(

        veda.id,

        mantra.id

    );





    root.innerHTML=`


    <div class="mantraDetail">


        <div class="sanskritBlock">


        ${mantra.sanskrit_swara ||

        mantra.sanskrit_text ||

        ""}


        </div>



    </div>



    <div class="scholarContainer">


    ${scholars.map(s=>`


        <div class="scholarCard"

        data-scholar="${s.id}">


            <h3>

            ${s.name}

            ${s.downloaded ? "" : "⬇"}

            </h3>



            <div

            class="scholarBody">


            </div>



        </div>



    `).join("")}



    </div>


    `;






    root.querySelectorAll(".scholarCard")

    .forEach(card=>{


        loadScholarPanel(

            card,

            card.dataset.scholar,

            mantra.id

        );


    });



}









async function loadScholarPanel(

    card,

    scholarId,

    mantraId

){



    const body =

    card.querySelector(".scholarBody");



    const scholars =

    await window.VedaDB.getScholarsForMantra(

        null,

        mantraId

    );



    const scholar =

    scholars.find(

        s=>s.id == scholarId

    );



    if(!scholar)

        return;






    if(!scholar.downloaded){



        body.innerHTML=`


        <button class="bookBtn">

        ভাষ্য ডাউনলোড করুন

        </button>


        `;



        body.querySelector("button")

        .onclick=async()=>{


            await window.VedaDB.downloadPack(

                scholar.id,

                scholar.pack_file,

                msg=>{

                    body.textContent=msg;

                }

            );



            location.reload();



        };



        return;

    }







    body.innerHTML=

    "লোড হচ্ছে…";





    try{


        const fields =

        await window.VedaDB

        .getBhashyaForMantraFromPack(

            scholar.id,

            mantraId

        );



        body.innerHTML=


        fields.map(f=>`


        <div class="field">


        <b>${f.field_key}</b>


        <p>${f.value}</p>


        </div>


        `).join("");




    }


    catch(e){


        body.textContent=

        e.message;


    }


}


/**
 * SEARCH SCREEN
 */


async function screenSearch(){


    showBack(true);


    setTitle("খুঁজুন");



    root.innerHTML = `


    <div class="searchBox">


        <input

        id="searchInput"

        type="text"

        placeholder="সংস্কৃত, বাংলা বা ইংরেজিতে খুঁজুন...">


    </div>



    <div id="searchResults">

    </div>


    `;



    const input =

    document.getElementById(

        "searchInput"

    );



    let timer;



    input.addEventListener(

        "input",

        ()=>{


            clearTimeout(timer);



            timer=setTimeout(

                ()=>runSearch(input.value),

                400

            );



        }

    );



}








async function runSearch(term){



    const resultBox =

    document.getElementById(

        "searchResults"

    );



    if(!term || term.trim().length<2){


        resultBox.innerHTML="";

        return;


    }





    try{


        const results =

        await window.VedaDB.search(

            null,

            term,

            50

        );




        if(!results.length){


            resultBox.innerHTML=

            `<div class="empty">

            কোনো ফলাফল নেই।

            </div>`;

            return;


        }




        resultBox.innerHTML=


        results.map(r=>`


        <a class="mantraItem"

        href="#/mantra/${r.veda_code}/${encodeURIComponent(r.mantra_ref_id)}">


            <div class="mref">

            ${r.veda_code}

            ${r.mantra_ref_id}

            </div>



            <div class="mtext">

            ${(r.content || "").slice(0,100)}

            </div>



        </a>


        `).join("");



    }


    catch(e){



        resultBox.innerHTML=

        `<div class="empty">

        Search Error

        </div>`;


        console.error(e);


    }



}









/**
 * HASH ROUTER
 */


async function router(){



    const hash =

        location.hash || "#/";



    const parts =

        hash

        .replace(/^#\//,"")

        .split("/")

        .filter(Boolean);





    try{



        if(parts.length===0)

            return screenHome();





        switch(parts[0]){



            case "search":


                return screenSearch();





            case "library":



                if(parts.length===1)

                    return screenLibrary();



                if(

                    parts[1]==="read"

                    &&

                    parts[2]

                )

                    return screenLibraryReader(

                        parts[2]

                    );


                break;







            case "veda":



                if(parts.length===2)

                    return screenVeda(

                        parts[1]

                    );




                if(parts.length===3)

                    return screenLevel1(

                        parts[1],

                        parts[2]

                    );




                if(parts.length===4)

                    return screenLevel2(

                        parts[1],

                        parts[2],

                        parts[3]

                    );



                break;







            case "mantra":



                if(parts.length===3)

                    return screenMantra(

                        parts[1],

                        parts[2]

                    );


                break;





            case "settings":


                if(window.SettingsUI)

                    return window.SettingsUI.render();


                break;




        }



        return screenHome();



    }



    catch(e){



        console.error(e);



        root.innerHTML=`


        <div class="empty">


        পেজ লোড করতে সমস্যা হয়েছে।


        <br><br>


        <small>

        ${e.message || e}

        </small>


        </div>


        `;



    }



}






/**
 * Navigation events
 */


window.addEventListener(

    "hashchange",

    router

);





if(backBtn){


    backBtn.onclick=()=>{


        if(history.length)

            window.history.back();


        else

            location.hash="#/";


    };


}






if(searchBtn){


    searchBtn.onclick=()=>{


        location.hash="#/search";


    };


}


/**
 * APP BOOT
 */


async function boot(){


    root.innerHTML = `


    <div class="loadingFull">


        <div class="omBig">

            ओ३म्

        </div>



        <div class="loadingText">

            ডাটাবেস লোড হচ্ছে...

        </div>



        <div class="loadingVersion">

            ${APP_BUILD_VERSION}

        </div>


    </div>



    `;





    try{



        await window.VedaDB.initDB();



        await router();



    }



    catch(e){



        console.error(e);



        root.innerHTML = `


        <div class="empty">


        ডাটাবেস চালু করতে সমস্যা হয়েছে।



        <br><br>


        <b>

        ${e.message || e}

        </b>



        </div>



        `;


    }



}









/**
 * Capacitor Ready
 *
 * Android Native App
 */


document.addEventListener(

    "deviceready",

    boot

);








/**
 * Browser fallback
 *
 * SQLite native plugin unavailable
 */


if(

    !window.Capacitor

    ||

    !window.Capacitor.isNativePlatform

    ||

    !window.Capacitor.isNativePlatform()

){



    window.addEventListener(

        "DOMContentLoaded",

        ()=>{


            root.innerHTML=`


            <div class="empty">


            এই অ্যাপটি Android Capacitor
            পরিবেশের জন্য তৈরি।


            <br><br>


            Browser preview এ
            SQLite Database কাজ করবে না।


            </div>


            `;


        }

    );


}








/**
 * Global debug helpers
 */


window.Chaturveda = {


    version:APP_BUILD_VERSION,


    reload:()=>{

        location.reload();

    },


    clearCache:async()=>{


        if(window.VedaDB){


            console.log(

            "Use Android Settings → Clear Storage"

            );


        }


    }


};
