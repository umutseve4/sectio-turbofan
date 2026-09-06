<p align="center">
  <img src="https://github.com/user-attachments/assets/3bee6485-38ba-44e2-aab6-772f0a720e95" alt="SECTIO — turbofan motorunun canlı kesiti, sıcaklık boyamalı gaz yolu" width="900">
</p>

<h1 align="center">SECTIO — Turbofan</h1>

<p align="center">
  Bir turbofan motorunun <b>canlı kesiti</b>. Kesme düzlemini gezdirdiğinizde kesit yüzeyi<br>
  gerçekten hesaplanır — önceden çizilmiş bir görsel açılıp kapanmaz.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/harici%20kaynak-0-FF4D4F?style=flat-square" alt="Sıfır harici kaynak">
  <img src="https://img.shields.io/badge/motor%20par%C3%A7as%C4%B1-15-FF4D4F?style=flat-square" alt="15 motor parçası">
  <img src="https://img.shields.io/badge/CI%20kontrol%C3%BC-27-FF4D4F?style=flat-square" alt="27 CI kontrolü">
</p>

---

## 30 saniyede ne oluyor?

Motor bir resim değil. Her kare, işaretli mesafe alanlarından (SDF) ray marching ile katı olarak çizilir. Kesme düzlemini kaydırdığınızda kesit yüzeyi o an hesaplanır ve ayrı gölgelendirilir — tarama çizgileri ve ısı parıltısıyla. Gaz kolunu ittiğinizde basitleştirilmiş bir Brayton çevrimi çalışır; OPR, T4, itki, TSFC ve lüle hızları hem panelde okunur hem de gaz yolunun sıcaklık boyamasını besler. İmlecin altındaki parçanın adı, istasyon sıcaklığı ve basıncı ekrana yazılır — bu bilgi GPU'dan 1×1 piksellik ayrı bir geçişle geri okunur.

## Nasıl açarım?

```
1. index.html dosyasını indirin
2. Çift tıklayın
```

Üçüncü adım yok. Uygulama kodu hiçbir harici kaynağa başvurmaz: CDN yok, font yok, analitik yok, `fetch`/XHR/WebSocket yok. Pages ile yayınlamak isterseniz Settings → Pages → `main` / root.

## Kısayollar

| Tuş | Etki |
|---|---|
| Sürükle | Yörünge · `⇧`+sürükle: kaydır · tekerlek: yakınlaş |
| `alt`+tekerlek | Kesme düzlemini it |
| `X` `Y` `Z` `V` | Düzlem normalini seç (`V`: kameraya dik) |
| `C` | Kesmeyi aç / kapat |
| `⇧` (basılı) | Düzlemi olduğu yerde tut |
| `F` | Görüntüyü dondur |
| `[` `]` | Dilim kalınlığı |
| `O` | Saydam (optik) mod |
| `H` | Arayüzü gizle — üç kademe |
| `1` `2` `3` | Kalite |
| `Boşluk` / `P` | Oynat / duraklat |
| `R` | Sıfırla |

`prefers-reduced-motion: reduce` açıksa sahne durağan başlar.

## İçindekiler

| Katman | Ne yapar |
|---|---|
| **Geometri** | 15 parça: nasel, çekirdek kaportası, spinner, 20 kanatlı fan, OGV, 3 kademe booster, rotor tamburu, 9 kademe HP kompresör, halka yanma odası, HP türbin, LP türbin, iç içe iki mil (LP + HP), egzoz konisi, pilon |
| **Kesme düzlemi** | X / Y / Z / serbest düzlem; yarım uzay ya da ayarlanabilir kalınlıkta dilim. Kesit yüzeyi ayrı gölgelendirilir |
| **Termodinamik** | Gaz kolu N1'e bağlı seyir Brayton çevrimi: OPR, T4, itki, TSFC, lüle hızları, N2 |
| **Okuma** | İmlecin altındaki parça 1×1 piksellik ayrı bir geçişle GPU'dan geri okunur |
| **Yedek** | WebGL2 yoksa veya ekran darsa **aynı mesafe alanının JS portundan** piksel piksel çizilen 2B meridyen kesiti devreye girer |

## Doğrulama

Tarayıcı açılamayan bir ortamda geliştirildiği için doğrulanabilir olan her şey `verify.mjs` ile CI'da koşar — **27 kontrol**:

```
node verify.mjs
```

- Dosyanın gerçekten kendine yetmesi (harici kaynak yok, `fetch`/XHR/WebSocket yok)
- Her `<script>` bloğunun ayrıştığı
- GLSL'in yapısal sağlığı: `#version 300 es`, denge, ES 1.00 kalıntısı yok, fonksiyonların kullanılmadan önce tanımlanması, **shader'daki uniform kümesi ile JS'in bağladığı kümenin iki yönlü birebir eşleşmesi**
- Çevrimin fiziği: gaz koluna göre monotonluk, istasyon sıcaklık sıralaması (T2 &lt; T13 &lt; T25 &lt; T3 &lt; T4 &gt; T45 &gt; T5), T4 tavanı, OPR / itki / TSFC / yakıt-hava oranının sınıf aralığında kalması, hiçbir gaz kolunda NaN olmaması
- Geometri: dolu olması gereken 7 nirengi noktasının dolu, boş olması gereken 4 noktanın boş olması; baypas kanalının ve çekirdek gaz yolunun her istasyonda açık kalması; modelin ray marching sınırlarını taşmaması; mesafe alanının gradyan büyüklüğünün örneklenen noktalarda 1'i aşmaması

Geometri ayrıca çevrimdışı olarak NumPy'de yeniden yazılıp raymarch edilerek karşılaştırıldı; kanat sıralarını atlamak için kullanılan sınırlayıcı bantların geometriyi gerçekten kapsadığı 1,5 milyon örnek noktada ampirik olarak ölçüldü. Bu bir ispat değil, geniş bir örneklemdir.

## Sınırlar

**Doğruluk.** Çevrim modeli **öğretici seviyededir**: büyüklük mertebeleri ve eğilimler doğrudur, sertifikasyon verisi değildir. Uçuş koşulu M 0.82 · 11 km · ISA olarak sabittir, bu yüzden okunan itki bir *seyir* itkisidir; kalkış değeri değildir. Kanat ve kademe sayıları yüksek baypaslı bir dar gövde motorunun mertebesinde seçilmiştir; belirli bir üreticinin belirli bir motoru modellenmemiştir.

**Doğrulamanın kapsamadığı.** Yukarıdaki 27 kontrol shader'ın gerçek bir GPU'da derlendiğini, kare hızını, seçim (pick) geçişini ve 3B etiket yerleşimini ölçmez. Bunlar ancak dosyayı açınca test edilir — yukarıdaki ekran görüntüsü o testin yapıldığını gösteriyor.

---

MIT — bkz. [LICENSE](LICENSE).
