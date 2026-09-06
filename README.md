# SECTIO — Turbofan

Bir turbofan motorunun **canlı kesiti**. Motor bir resim değil: her kare, işaretli
mesafe alanlarından (SDF) ray marching ile katı olarak çizilir. Kesme düzlemini
gezdirdiğinde kesit yüzeyi gerçekten hesaplanır — önceden çizilmiş bir görsel
açılıp kapanmaz.

Tek dosya, sıfır bağımlılık, sıfır ağ isteği: `index.html`.

![kesit](docs/hero.png)

## Ne var içinde

| katman | ne yapar |
|---|---|
| geometri | 15 parça: nasel, çekirdek kaportası, spinner, 20 kanatlı fan, 3 kademe booster, 9 kademe HP kompresör, halka yanma odası, HP/LP türbin, iç içe iki mil, egzoz konisi, pilon, OGV |
| kesme düzlemi | X / Y / Z / serbest düzlem; yarım uzay ya da ayarlanabilir kalınlıkta dilim. Kesit yüzeyi ayrı gölgelendirilir (tarama + ısı parıltısı) |
| termodinamik | gaz kolu N1'e bağlı basitleştirilmiş seyir Brayton çevrimi: OPR, T4, itki, TSFC, lüle hızları, N2 — hem panelde okunur hem de sıcaklık/basınç boyamasını besler |
| okuma | imlecin altındaki parça 1×1 piksellik ayrı bir geçişle GPU'dan geri okunur; parça adı, istasyon sıcaklığı ve basıncı yazılır |
| yedek | WebGL2 yoksa veya ekran dar ise **aynı mesafe alanından** JS ile piksel piksel çizilen 2B meridyen kesiti devreye girer |

## Kısayollar

| tuş | etki |
|---|---|
| sürükle | yörünge · `⇧`+sürükle: kaydır · tekerlek: yakınlaş |
| `alt`+tekerlek | kesme düzlemini it |
| `X` `Y` `Z` `V` | düzlem normalini seç (`V`: kameraya dik) |
| `C` | kesmeyi aç/kapat |
| `⇧` (basılı) | düzlemi olduğu yerde tut |
| `F` | görüntüyü dondur |
| `[` `]` | dilim kalınlığı |
| `O` | saydam (optik) mod |
| `H` | arayüzü gizle — üç kademe |
| `1` `2` `3` | kalite |
| `Boşluk` / `P` | oynat / duraklat |
| `R` | sıfırla |

`prefers-reduced-motion: reduce` açıksa sahne durağan başlar.

## Doğruluk sınırı

Çevrim modeli **öğretici seviyededir**: büyüklük mertebeleri ve eğilimler doğrudur,
sertifikasyon verisi değildir. Kanat sayıları ve kademe sayıları yüksek baypaslı bir
dar gövde motorunun mertebesinde seçilmiştir; belirli bir üreticinin belirli bir
motoru modellenmemiştir.

## Doğrulama

Bu depoda tarayıcı açılamadığı için doğrulanabilir olan her şey `verify.mjs` ile
CI'da koşar (27 kontrol):

- dosyanın gerçekten kendine yeter olması (harici kaynak yok, `fetch`/XHR/WebSocket yok)
- her `<script>` bloğunun ayrıştığı
- GLSL'in yapısal sağlığı: `#version 300 es`, denge, ES 1.00 kalıntısı yok,
  fonksiyonların kullanılmadan önce tanımlanması, **shader'daki uniform kümesi ile
  JS'in bağladığı kümenin iki yönlü birebir eşleşmesi**
- çevrimin fiziği: gaz koluna göre monotonluk, istasyon sıcaklık sıralaması
  (T2 &lt; T13 &lt; T25 &lt; T3 &lt; T4 &gt; T45 &gt; T5), T4 tavanı, OPR / itki / TSFC / yakıt-hava
  oranının sınıf aralığında kalması, hiçbir gaz kolunda NaN olmaması
- geometri: dolu olması gereken 7 nirengi noktasının dolu, boş olması gereken 4
  noktanın boş olması; baypas kanalının ve çekirdek gaz yolunun her istasyonda açık
  kalması; modelin ray marching sınırlarını taşmaması; mesafe alanının gradyan
  büyüklüğünün 1'i aşmaması (küre izleme aşırı adım atmasın diye)

```
node verify.mjs
```

Geometri ayrıca çevrimdışı olarak NumPy'de birebir yeniden yazılıp raymarch edilerek
karşılaştırıldı; kanat sıralarını atlamak için kullanılan sınırlayıcı bantların
geometriyi gerçekten kapsadığı 1,5 milyon örnek noktada ayrıca ölçüldü.

## Çalıştırma

`index.html` dosyasını çift tıkla. Sunucu, derleme, paket yok.
Depoyu GitHub Pages ile yayınlamak istersen: Settings → Pages → Source: `main` / `root`.

## Lisans

MIT.
