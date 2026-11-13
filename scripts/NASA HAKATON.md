# NASA HAKATON

Tapşırıq:

For decades, NASA has studied how flames and fire behave in microgravity, gathering a trove of experimental data along the way. That knowledge matters more than ever as humans gear up to return to the Moon and press on to Mars, yet the volume of results makes them hard to find, compare, and understand. Your challenge is to create an interactive, AI-powered dashboard that summarizes, ranks, and interprets those findings to deliver fire safety insights for human space exploration.

---

### Sözügedən  məqalələrin mənbəsi

1.  https://ntrs.nasa.gov/ 
2. http://taskbook.nasaprs.com/

---

### Araşdırmadan Süni İntelekt ilə nəticəyə gedən iş axışı - Dokumentasiya

Araşdırma(Məqalə) → 

Məqaləni oxuyub aşağıdakı cavabları bizə göndərsin

1. Araşdırmanın **xülasəsi**
2. Məqalənin araşdırılmasından sonra suni intelektin tövsiyə etdiyi **təhlükəsizlik tədbiri**
3. **Ranking**(Önəm sırası)

Bu 3 mənbəni necə vercəyinə aid aşağıdakı suallara cavab tapaq:

- [ ]  Xülasəni araşdırmada nəyə əsasən qoyacaq
- [ ]  Təhlükəsizlik tədbirini tövsiyə verəndə Suni İntelektin nəzərə almalı olduğu NASA-nın qoyduğu standartları. Nümunə:

https://www.nasa.gov/ochmo/human-spaceflight-and-aviation-standards/

Yəni təhlükəsizlik tədbiri tövsiyə verilərkən içərisində insan olan kosmik gəmi üçün mütləq nəzərdə tutulmalı olan məqamlar

- [ ]  Hansı faktorlara əsasən bu araşdırma və suni intelektin aldığı nəticəni ölçəciyik.

→ Suni İntelekt ilə hər araşdırma üçün bu prosesin bir bir təkrar edilməsi. 

→Verilənlər bazasını yaratmaq bu tapıntılarda ibarət

→Dashboard(Vebsayt) hazırlamaq.

→Bütün nasanın məqalələrinin sistemə əlavə edilməsi və suni intelektin prosesi etməsi halhazırda excel fayllarında olmayanlar üçün.

---

### Aktual praqram

[https://colab.research.google.com/drive/14CeSF_kAKZ18gmG5XxfNzUnhRqLuJK86?usp=sharing](https://colab.research.google.com/drive/14CeSF_kAKZ18gmG5XxfNzUnhRqLuJK86?usp=sharing)

## Tapşırıqlar

1. Bu qədər veriləni necə sıra ilə yüklüyüb suni intellekt ilə analiz edib verilenler bazasina yaddaşa vurub bütün hamsını işlənmiş şəkildə qoyacağımızı tapmaq.

Birinci böyük toplu araşdırmalar(FLEX, Same, Sapphire) əldə edilir. 

1. Bu qədər böyüklükdə gigabaytlarla ölçülən məlumatı birbaşa suni intellekte atmaq qeyri-mümkündür. Ona görə nöyük araşdırmalar chunkslara(hissələrə) bölünür.
2. Python skripti PDF faylını oxuyur və əgər varsa mündəricat səhifəsini, yoxdursa hər səhifənin ilk sətirlərini (başlıqlarını) qısa bir indeks olaraq çıxarır. Sonrasında bu başlıqları lokalda llama modelinə göndərir. Model buna baxır və təhlükəsizlik tövsiyəsi üçün hansı hissələrin açar olduğunu, abstrakt, experiment və nəticədən əlavə. Bu səhifə aralıqlarını llama modeli baxır və lazımi səhifələrin siyahısını verir. Spesifik səhifə aralıqlarını göndərir.
3. Python ilə həmin səhifələr jsona çevrilir.
4. Həmin json LLama modelinə göndərilir və artıq təhlükəsizlik tövsiyələri və əlavə soruşduğumuz parametrlər cavab olaraq alınır. Nasanın kosmik gəmi startları nəzərə alınır.
5. Son olaraq bir daha eyni model oxuyur jsonu və llamanın cavablarına baxır, bu modelin internetə çıxışı olur və məntiqə uyğun olmayan yerləri düzəldir və düzəlişlər olaraq əlavə edir. Eyni model təhlükəsizlik tövsiyəsini verən modellə dialoqa girir və niyə bu səbəbə gəldiyini anlamağa çalışır. Bir daha kosmik gəmi standartlarına uyğun gəlib gəlmədiyi araşdırlır.
6. Dashboardda görünür. Simulasiyalar və fərqli interaktiv yollarla istifadəçiyə göstərilir. PDF olaraq yükləmək olur təhlükəsizlik tövsiyəsini əhatəli şəkildə. 

## Təqdimat

5-ci addımda 2 suni intelektin söhbətlərinin ss-lərini qoymaq.

Ən maraqlı, yararlı təhlükəsizlik tövsiyələrini qoymaq.

İş axışı.

Canlı olaraq bir araşdırmanın alınıb, suni intellektin nəticəyə gəlməsi.

## Mehemmedin fikirləri

Araşdırma(PSİ) başdan sona suni intelekt tərəfindən oxunur. Bu araşdırma üçün suni intelekt nə qədər mümkündürsə çox təhlükəsizlik tövsiyəsi onlar çıxır(100 dənə belə olsa). Bunların arasından ən çox işə yararlı 5 dənə ən efektiv olanları çıxardır. Sonra araşdırmalara bir də baxır sonra baxır tövsiyələr arasından top 5 dənə seçdiyi digərlərindən niyə görə önə çıxır əsaslandırsın. 

## İcraat

1. Məlumatların toplanması - Python skripti vasitəsi ilə kosmosda alova aid bütün psi araşdırmaları skrap edili. Fayl sturukturu yaddaşda saxlanıldı. Bütün faylların uzantıları, fayl yolları verilənlər bazamıza yazıldı. Sonrasında bu bazanın ən böyük həcm tutan hissəsi olan şəkil və videolardan başqa suni intellekt üçün mənalı olan hissə 1.2TB datadan aşağıdakı 4.7GB toplam həcmd olan fayllar yüklənildi və yenidən istinad etmək asan olsun deyə nasanın sturukturunda yüklənildi komputerə

PDF + .txt/.rtf + bütün Ofis (xls, xlsx, doc, docx, ppt, pptx)

---

## ADDIM 2 - Datadan çıxarılacaq nəticələr

Dashboardın açığlaması - Suni İntelekt əsaslı, veb-app

To build an *AI-powered, web-based dashboard* that summarizes, ranks, and interprets the results of combustion investigations to deliver fire safety insights.

Bu tool aşağıdakı funksiyaları olmalıdır.

- [ ]  Identify investigations most relevant to the fire safety needs of habitable crew environments.
- [ ]  Extract data that supports predictive modeling of flammability and fire scenarios in space exploration.
- [ ]  Highlight research that informs the development of next-generation fire safety controls and equipment.

add-on:

- [ ]  Your dashboard could also address potential applications of the PSI data to fire safety on Earth.

## Fərqli PSI araşdırmalarının əlaqələndirilməsi

- [ ]  **JSON metadata indeksini oxumaq:** Python skripti yazaraq `psi_network` JSON fayllarını parse etmək və 5 GB-lıq qovluqdakı bütün faylların siyahısını (fayl adı, tipi, ölçüsü, `Run` nömrəsi) çıxarmaq.
- [ ]  **Faylları kateqoriyalara bölmək:** Datanı 5 test materialı (*Teflon, Kapton, Silicone, Pyrell, Lampwick*) və eksperiment şərtləri (*Flight vs Ground*, *Aged vs Unaged*, *Flow vs No Flow*) üzrə qruplaşdırmaq.
    - [ ]  **NASA hesabatlarını nəzərdən keçirmək:** Arxivdəki `SAME-R_Final Report.pdf` və `Detection of Smoke from Microgravity Fires.ppt` fayllarını oxuyub əsas fiziki terminləri, eksperiment quruluşunu və mövcud sensor limitlərini qeyd etmək.