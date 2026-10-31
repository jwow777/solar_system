# Карты спутников

В этом каталоге хранятся 17 скачанных карт для Атласа Солнечной системы. Карта Луны находится в родительском каталоге. Точные URL изображений, авторы, ссылки и параметры обработки перечислены в [moonTextureCredits.json](../../../constants/moonTextureCredits.json).

| Спутники | Данные и авторство |
| --- | --- |
| Ио, Европа, Ганимед, Каллисто | [NASA/JPL Solar System Simulator](https://maps.jpl.nasa.gov/tmaps/jupiter.html). Voyager, Caltech/JPL/USGS; Ио — David Seal, цвет по Galileo. Исходники 1440×720. |
| Мимас, Энцелад, Тефия, Диона, Рея, Япет | NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute, Paul Schenk. Цветные мозаики Cassini 2014: PIA18434–PIA18439. [Описание обработки](https://science.nasa.gov/resource/color-map-of-enceladus-2014/). |
| Титан | [NASA PIA19658](https://science.nasa.gov/resource/titan-global-map-june-2015/), NASA/JPL-Caltech/SSI. Мозаика Cassini ISS 2015, 938 нм. |
| Миранда, Ариэль, Умбриэль, Титания, Оберон | [NASA/JPL Solar System Simulator](https://maps.jpl.nasa.gov/tmaps/uranus.html). Voyager, Caltech/JPL/USGS, Tammy Becker. Исходники 1440×720. |
| Тритон | [NASA PIA18668](https://science.nasa.gov/resource/map-of-triton/). Voyager 2, NASA/JPL-Caltech/Lunar and Planetary Institute, Paul Schenk. |

Изображения используются для образовательной визуализации с указанием авторства по [правилам NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/). Логотипы NASA не используются; лицензия проекта не распространяется на сторонние материалы автоматически.

Карты приведены к JPEG шириной до 4096 пикселей без увеличения исходного разрешения. Мозаики Cassini содержат усиленные цвета, охватывающие УФ- и ИК-диапазоны; чёрно-белые карты не раскрашивались. У Титана удалены рамка, подписи и заголовок: это изображение поверхности в ИК, а не видимый сквозь атмосферу естественный цвет. В мозаиках спутников Урана и Тритона чёрные пропуски заменены нейтральным серым цветом без добавления вымышленных деталей. Это не полная фотографическая съёмка поверхности.

Команда `npm run assets:download-moons` загружает отсутствующие файлы с исходных адресов и повторяет обработку. Существующие файлы сохраняются. Обычная сборка использует локальные изображения и не обращается к внешним серверам за картами.
