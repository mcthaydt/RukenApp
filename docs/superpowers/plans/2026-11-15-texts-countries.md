# Texts: what each country asks for

Belongs to `2026-11-15-texts-not-email.md` (the texts plan). The texts spec asks the plan to list, from Twilio's own pages, every country Twilio reaches, what each asks for and how long it takes.

**How this was made.** On 2026-11-15 the plan session downloaded Twilio's rules page for each of the 222 countries linked from `https://www.twilio.com/en-us/guidelines/sms` (one page each, at `https://www.twilio.com/en-us/guidelines/<iso>/sms`) and copied the cells below out of each page's tables with a script. Nothing here was typed by hand. Long cells are cut with "…"; "---" and "N/A" are Twilio's own. Sweden's page had no sender table that day, so its row is empty and is read by hand in Task 11. The pages change: Task 11 reads them again before the list of open countries is written.

**How to read a row.**

- **Two-way**: whether a person in that country can text Ruken back (Twilio's "Two-way SMS supported"). Only there can STOP, START, HELP and help by text work. It is "Yes" in 43 of the 222, and replying needs a number of that country.
- **Registered name**: sending under the name "Ruken", registered first. "Required" means no text arrives until it is registered. **Its wait** is how long Twilio says registering takes.
- **Unregistered name**: sending under the name "Ruken" with no registration.
- **Local number** and **Number from abroad**: sending from an ordinary phone number of that country, or of another.

**Counted from the table.**

- Two-way "Yes": 43. Two-way "No": 179.
- A registered name is "Required" before any text arrives, for all or some of the country's networks: Austria, Bangladesh, Finland, Ireland, Kazakhstan, Liberia, Romania, Singapore, Spain, Thailand, Venezuela, Zimbabwe. The United Kingdom asks it only for protected names.
- The United States asks for registration of a local number ("Requires registration" on Twilio's page): that is the carriers' approval the spec's launch waits for.
- Neither an unregistered name nor an ordinary number is marked plainly "Supported" for: Burundi, Cuba, Ethiopia, Iran, Iraq, Kenya, Kuwait, Norfolk Island, Qatar, Russia, Saudi Arabia, Sri Lanka, Swaziland, Syria, Tanzania, Timor-Leste, Tuvalu, United Arab Emirates, Uzbekistan. In some of them a registered name works, on all or some networks (their rows say which); in the rest no text can be sent. Task 11 reads each by hand, and each starts closed.

| Country | ISO | Code | Two-way | Registered name | Its wait | Unregistered name | Local number | Number from abroad |
|---|---|---|---|---|---|---|---|---|
| Afghanistan | AF | +93 | No | Supported Twilio recommends r… | 1 week | Supported (Except for the ope… | Not Supported | Supported |
| Albania | AL | +355 | No | Not Required | --- | Supported | Not Supported | Supported |
| Algeria | DZ | +213 | No | Not Supported / Supported | N/A / 2 weeks | Supported | --- | Supported |
| American Samoa | AS | +1684 | No | Not Required | --- | Supported | --- | Supported |
| Andorra | AD | +376 | No | Not Required | --- | Supported | Not Supported | Supported |
| Angola | AO | +244 | No | Not Required | --- | Supported | --- | Supported |
| Anguilla | AI | +1264 | No | Not Required | --- | Supported | Not Supported | Supported |
| Antigua and Barbuda | AG | +1268 | No | Not Required | --- | Supported | Not Supported | Supported |
| Argentina | AR | +54 | Yes | --- | N/A | Supported | Not Supported | Supported |
| Armenia | AM | +374 | No | Supported | 3 weeks | Supported | --- | Supported |
| Aruba | AW | +297 | No | --- | --- | Supported | --- | Supported |
| Australia | AU | +61 | Yes | Supported | 5 business days | Not Supported | Supported | Supported |
| Austria | AT | +43 | Yes | Required | Up to 4 weeks | Not Supported | Supported | Not Supported |
| Azerbaijan | AZ | +994 | No | --- | N/A | Supported | --- | Supported |
| BN | BN | ? | No | --- | N/A | Supported | --- | Supported |
| Bahamas | BS | +1242 | No | Not Required | --- | Supported | Not Supported | Supported |
| Bahrain | BH | +973 | No | Not Required | --- | Supported | Not Supported | Supported |
| Bangladesh | BD | +880 | No | Required for Robi, Teletalk a… / Not Supported | 3 weeks / N/A | Not Supported for GrameenPhon… | --- | Not Supported for GrameenPhon… |
| Barbados | BB | +1246 | No | Not Required | --- | Supported | Not Supported | Supported |
| Belarus | BY | +375 | No | Supported / Not Supported | 3 weeks / N/A | — | --- | Supported |
| Belgium | BE | +32 | Yes | Not Required | --- | Not Supported | Supported | Supported |
| Belize | BZ | +501 | No | Not Required | N/A | Supported | Not Supported | Supported |
| Benin | BJ | +229 | No | Supported | 3 weeks | Supported | --- | Supported |
| Bermuda (UK) | BM | +1441 | No | --- | N/A | Supported | Not Supported | Supported |
| Bhutan | BT | +975 | No | --- | N/A | Supported | --- | Supported |
| Bolivia | BO | +591 | Yes | Not Supported | N/A | Supported | Not Supported | Supported |
| Bosnia and Herzegovina | BA | +387 | No | --- | N/A | Supported | --- | Supported |
| Botswana | BW | +267 | No | --- | N/A | Supported | --- | Supported |
| Brazil | BR | +55 | Yes | Supported (Optional) | 10 weeks | --- | Supported | Supported |
| British Virgin Islands (UK) | VG | +1284 | No | --- | N/A | Supported | --- | Supported |
| Bulgaria | BG | +359 | No | Not Supported / Supported | N/A / 4 weeks | Supported | --- | Supported |
| Burkina Faso | BF | +226 | No | --- | N/A | Supported | --- | Supported |
| Burundi | BI | +257 | No | Supported for Lumitel | 3 weeks | Not Supported for Lumitel Sup… | --- | Not Supported for Lumitel Sup… |
| Cambodia | KH | +855 | No | Supported | 14 business days | Supported | Not Supported | Supported |
| Cameroon | CM | +237 | No | Supported / Not Supported | 3 weeks / N/A | Supported | Not Supported | Supported |
| Canada | CA | +1 | Yes | --- | N/A | --- | Supported | --- |
| Cape Verde | CV | +238 | No | --- | N/A | Supported | --- | Not Supported |
| Cayman Islands (UK) | KY | +1345 | No | Not Required | --- | Supported | Not Supported | Supported |
| Central African Republic | CF | +236 | No | --- | N/A | Suppported | Not Supported | Supported |
| Chad | TD | +235 | No | Not Supported | N/A | Supported | Not Supported | Not Supported |
| Chile | CL | +56 | Yes | --- | N/A | Supported | Supported | Supported |
| China | CN | +86 | No | Not Supported / Not Supported | N/A / N/A | Not Supported | Not Supported | Supported |
| Colombia | CO | +57 | Yes | --- | N/A | Not Supported | Not Supported | Supported |
| Comoros | KM | +269 | No | --- | N/A | Supported | Not Supported | Supported except HURI network |
| Cook Islands | CK | +682 | No | Not Required | --- | Supported | Not Supported | Supported |
| Costa Rica | CR | +506 | No | Not Required | --- | Not Supported | Not Supported | Supported |
| Croatia | HR | +385 | No | --- | --- | Supported | Not Supported | Supported |
| Cuba | CU | +53 | No | Not Supported | N/A | Not Supported | Not Supported | Not Supported |
| Cyprus | CY | +357 | No | --- | N/A | Supported | --- | Supported |
| Czech Republic | CZ | +420 | Yes | Supported | 3 weeks | Not Supported for T-Mobile an… | Supported | Not Supported for T-Mobile an… |
| Democratic Republic of the Congo | CD | +243 | No | --- | --- | Supported | Not Supported | Supported |
| Denmark | DK | +45 | Yes | --- | N/A | Supported | Supported | Supported |
| Djibouti | DJ | +253 | No | --- | N/A | Supported | Not Supported | Supported |
| Dominica | DM | +1767 | No | --- | --- | Supported | --- | Supported |
| Dominican Republic | DO | +1829 | Yes | --- | N/A | Supported | --- | Supported |
| Ecuador | EC | +593 | No | Not Required | --- | Not Supported | Not Supported | Supported |
| Egypt | EG | +20 | No | Supported Twilio recommends r… / Supported | 1 week / 3 weeks | Supported | --- | Supported |
| El Salvador | SV | +503 | No | Supported Only for Claro | 1 week | Supported | Not Supported | Supported |
| Equatorial Guinea | GQ | +240 | No | --- | --- | Supported | Not Supported | Supported |
| Eritrea | ER | +291 | No | Not Required | --- | Supported | --- | Supported |
| Estonia | EE | +372 | Yes | --- | --- | Supported | Supported | Supported |
| Ethiopia | ET | 251 | No | Supported | 14 days | Not Supported for Ethio Telec… | Not Supported | Not Supported for Ethio Telec… |
| Faroe Islands | FO | +298 | No | --- | N/A | Supported | --- | Supported |
| Fiji | FJ | +679 | No | Not Supported | N/A | Supported | Not Supported | Supported |
| Finland | FI | +358 | Yes | Required | Up to 3 weeks | Supported | Supported | Supported |
| France | FR | +33 | Yes | --- | N/A | Supported | Supported | Supported |
| French Guiana (France) | GF | +594 | No | Not Required | --- | Supported | Not Supported | Supported |
| French Polynesia (France) | PF | +689 | No | --- | --- | Supported | Not Supported | --- |
| Gabon | GA | +241 | No | --- | --- | Supported | Not Supported | --- |
| Gambia | GM | +220 | No | --- | --- | Supported | Not Supported | Supported |
| Georgia | GE | +995 | No | --- | --- | Supported | Not Supported | Not Supported |
| Germany | DE | +49 | Yes | --- | --- | Supported | Supported | Supported |
| Ghana | GH | +233 | No | Supported / Supported | 3 weeks / 2 weeks | Not Supported for MTN Support… | Not Supported | Supported |
| Gibraltar (UK) | GI | +350 | No | --- | --- | Supported | Not Supported | --- |
| Greece | GR | +30 | No | --- | N/A | Supported | Not Supported | Not Supported |
| Greenland (Denmark) | GL | +299 | No | --- | N/A | Supported | Not Supported | Supported |
| Grenada | GD | +1473 | No | --- | --- | Supported | Not Supported | Supported |
| Guadeloupe | GP | +590 | No | --- | --- | Supported | Not Supported | Supported |
| Guam | GU | +1671 | No | --- | --- | Not Supported | Not Supported | Supported |
| Guatemala | GT | +502 | No | Supported Only for Claro | 2 weeks | Supported | --- | Supported |
| Guernsey | GG | +44 | No | --- | --- | Supported | Not Supported | --- |
| Guinea | GN | +224 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Guinea-Bissau | GW | +245 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Guyana | GY | +592 | No | Not Required | --- | Supported | --- | Supported |
| Haiti | HT | +509 | No | --- | N/A | Supported | Not Supported | Supported |
| Honduras | HN | +504 | No | Supported | 2 weeks | Supported | --- | Supported |
| Hong Kong | HK | +852 | Yes | Supported | 18 days | Not Supported for China Mobil… | Supported | Not Supported for China Mobil… |
| Hungary | HU | +36 | Yes | --- | N/A | Supported | Supported | Supported |
| Iceland | IS | +354 | No | --- | N/A | Supported | Supported | Supported |
| India | IN | +91 | Yes | Not Supported / Supported | N/A / 10 business days | Supported | --- | Supported |
| Indonesia | ID | +62 | No | Supported / Supported | 4 weeks / 3 weeks | Supported | Not Supported | Supported |
| Iran | IR | +98 | No | Not Supported | N/A | Not Supported | Not Supported | Not Supported |
| Iraq | IQ | +964 | No | Supported for Iraq Asiacell | 5 days | Not Supported for Asiacell Su… | --- | Not Supported for Asiacell an… |
| Ireland | IE | +353 | Yes | Required | 2 weeks | Supported | Not Supported | Supported |
| Israel | IL | +972 | Yes | Not Supported / Supported | N/A / 1 week | Supported | Supported | Supported |
| Italy | IT | +39 | Yes | --- | N/A | Supported | Supported | Not Supported |
| Ivory Coast | CI | +225 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Jamaica | JM | +1876 | No | --- | --- | Supported | --- | Supported |
| Japan | JP | +81 | Yes | Not Supported / When you need to deliver SMS … | N/A / 5 weeks | Supported | Not Supported | Supported |
| Jersey | JE | +4477003 | Yes | --- | --- | Supported | Supported | --- |
| Jordan | JO | +962 | No | Supported / Supported | 12 days / 12 days | Supported | Not Supported | Supported |
| Kazakhstan | KZ | +7 | No | Required | 3 weeks | Supported | --- | Supported |
| Kenya | KE | +254 | No | Supported / Not Supported | 4 weeks / N/A | Not Supported for Kenya Safar… | Not Supported | Not Supported |
| Kosovo | XK | 383 | No | --- | N/A | Supported | --- | Supported |
| Kuwait | KW | +965 | No | Supported / Not Supported | 4 weeks / N/A | Not Supported for Ooredoo and… | Not Supported | Not Supported for Ooredoo and… |
| Kyrgyzstan | KG | +996 | No | --- | --- | Supported | Not Supported | Supported |
| Laos | LA | +856 | No | --- | --- | Supported | --- | Supported |
| Latvia | LV | +371 | No | --- | N/A | Supported | --- | Supported |
| Lebanon | LB | +961 | No | Not Required | N/A | Supported | Not Supported | Supported |
| Lesotho | LS | +266 | No | Not Supported | --- | Supported | Not Supported | Supported |
| Liberia | LR | +231 | No | Required | 3 weeks | Supported | Not Supported | Supported |
| Libya | LY | +218 | No | --- | N/A | Supported | --- | No Supported |
| Liechtenstein | LI | +423 | No | --- | N/A | Supported | --- | Supported |
| Lithuania | LT | +370 | Yes | --- | N/A | Supported | Supported | Supported |
| Luxembourg | LU | +352 | No | --- | --- | Supported | Not Supported | Supported |
| Macao | MO | +853 | No | --- | N/A | Supported | --- | Supported |
| Macedonia | MK | +389 | No | --- | --- | Supported | Not Supported | Supported |
| Madagascar | MG | +261 | No | Not Required | --- | Supported | --- | Supported |
| Malawi | MW | +265 | No | Not Required | --- | Supported | Not Supported | Supported |
| Malaysia | MY | +60 | Yes | Not Supported / Supported | N/A / 2 weeks | Supported | Supported | Supported |
| Maldives | MV | +960 | No | Not Required | --- | Supported | Not Supported | Not Supported |
| Mali | ML | +223 | No | Not Required | --- | Supported | Not Supported | Supported |
| Malta | MT | +356 | No | --- | N/A | Supported | Not Supported | Supported |
| Marshall Islands | MH | +692 | No | --- | --- | Not Supported | --- | Supported |
| Martinique (France) | MQ | +596 | No | --- | --- | Supported | Not Supported | --- |
| Mauritania | MR | +222 | No | --- | N/A | Supported | Not Supported | Supported |
| Mauritius | MU | +230 | No | Not Supported | --- | Supported | --- | Supported |
| Mexico | MX | +52 | Yes | Supported / Supported | 3 weeks / 3 weeks | Supported | Supported With Limitations | Supported |
| Micronesia | FM | +691 | No | --- | --- | Not Supported | Not Supported | Supported |
| Moldova | MD | +373 | No | Not Required | --- | Supported | Not Supported | Supported |
| Monaco | MC | +377 | No | --- | N/A | Supported | Not Supported | Supported |
| Mongolia | MN | +976 | No | Not Required | --- | Supported | Not Supported | Not Supported for G-Mobile an… |
| Montenegro | ME | +382 | No | Not Required | --- | Supported | Not Supported | Supported |
| Montserrat (UK) | MS | +1664 | No | --- | --- | Supported | Not Supported | Supported |
| Morocco | MA | +212 | No | Supported / Supported | 3 weeks / 3 weeks | Supported | Not Supported | Supported |
| Mozambique | MZ | +258 | No | Supported Twilio recommends r… | 1 week | Supported | Not Supported | Supported |
| Myanmar | MM | +95 | Yes | Supported Twilio recommends r… | 1 week | Supported | Supported | Not Supported |
| Namibia | NA | +264 | No | Not Required | N/A | Supported | Not Supported | Not Supported |
| Nepal | NP | +977 | No | Supported | 2 weeks | Supported | Not Supported | Supported |
| Netherlands | NL | +31 | Yes | --- | N/A | Supported | Supported | Supported |
| Netherlands Antilles (Netherlands) | AN | +599 | No | --- | --- | Supported | Not Supported | --- |
| New Caledonia (France) | NC | +687 | No | --- | --- | Supported | Not Supported | Supported |
| New Zealand | NZ | +64 | Yes | N/A | N/A | N/A | N/A | Supported |
| Nicaragua | NI | +505 | No | Supported Only for Claro | 2 weeks | Supported | Not Supported | Supported |
| Niger | NE | +227 | No | Not Required | --- | Supported | Not Supported | Supported |
| Nigeria | NG | +234 | No | Supported / Supported only for the major … | 3 weeks / 2-3 weeks | Supported | Not Supported | Supported |
| Niue | NU | +683 | No | --- | --- | Supported | Not Supported | --- |
| Norfolk Island | NF | +672 | No | --- | --- | --- | Not Supported | --- |
| Norway | NO | +47 | Yes | --- | N/A | Supported | Supported | Supported |
| Oman | OM | +968 | No | Supported / Temporarily Suspended | 18 days / 14 days | Supported | Not Supported | Supported |
| Pakistan | PK | +92 | No | --- | N/A | Supported | Not Supported | Supported |
| Palau | PW | +977 | No | --- | --- | Supported | Not Supported | Supported |
| Palestine | PS | +970 | No | Not Required | N/A | Supported | Not Supported | Supported |
| Panama | PA | +507 | No | --- | N/A | Not Supported | Not Supported | Supported |
| Papua New Guinea | PG | +675 | No | --- | --- | Supported | Not Supported | Supported |
| Paraguay | PY | +595 | No | Not Supported | N/A | Not Supported | Not Supported | Supported |
| Peru | PE | +51 | No | --- | N/A | Supported | Not Supported | Supported |
| Philippines | PH | +63 | Yes | Supported / Supported | 2 weeks / 2 weeks | Not Supported | Supported | Not Supported |
| Poland | PL | +48 | Yes | --- | N/A | Supported | Supported | Supported |
| Portugal | PT | +351 | Yes | --- | N/A | Supported | Supported | Supported |
| Puerto Rico (US) | PR | +1 | Yes | --- | --- | Not Supported | Supported | --- |
| Qatar | QA | +974 | No | Supported | 2 weeks | Not Supported | Not Supported | Not Supported |
| Republic of the Congo | CG | +242 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Romania | RO | +40 | No | Required only for Telekom Rom… | 4 weeks | Supported except for Telekom … | Not Supported | Supported |
| Russia | RU | +7 | No | Not Supported after July of 2… / Not Supported | N/A / N/A | Not Supported | Not Supported | Not Supported |
| Rwanda | RW | +250 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Réunion (France) | RE | +262 | No | --- | N/A | Supported | Not Supported | Supported |
| Saint Lucia | LC | +1758 | No | Not Supported | N/A | Supported | Not Supported | Supported |
| Saint Vincent and the Grenadines | VC | +1784 | No | --- | --- | Supported | Not Supported | --- |
| Samoa | WS | +685 | No | --- | --- | Supported | Not Supported | --- |
| San Marino | SM | +378 | No | --- | --- | Supported | Not Supported | --- |
| Sao Tome and Principe | ST | +239 | No | --- | --- | Supported | Not Supported | — |
| Saudi Arabia | SA | +966 | No | Supported / Not Supported | 2 weeks / N/A | Not Supported | Not Supported | Not Supported |
| Senegal | SN | +221 | No | --- | N/A | Supported | Not Supported | Not Supported for Expresso an… |
| Serbia | RS | 381 | No | Supported (Optional) | 16 days | Supported | Not Supported | Supported |
| Seychelles | SC | +248 | No | --- | --- | Supported | Not Supported | --- |
| Sierra Leone | SL | +232 | No | --- | N/A | Supported | Not Supported | Supported |
| Singapore | SG | +65 | Yes | Required | 5 business days | Supported | Supported | Supported |
| Slovakia | SK | +421 | No | --- | --- | Supported | Supported | Supported |
| Slovenia | SI | +386 | No | --- | N/A | Supported | Supported | Supported |
| Solomon Islands | SB | +677 | No | --- | N/A | Supported | Not Supported | Supported |
| Somalia | SO | +252 | No | --- | --- | Supported | Not Supported | Supported except Somtel |
| South Africa | ZA | +27 | Yes | Not Supported | N/A | Not Supported | Supported | Supported |
| South Korea | KR | +82 | No | --- | N/A | --- | Not Supported | Supported |
| South Sudan | SS | +211 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Spain | ES | +34 | Yes | Required | Up to 4 weeks | Not Supported | Supported | Supported |
| Sri Lanka | LK | +94 | No | Supported / Supported | 3 weeks / 3 weeks | Not Supported for Dialog, Eti… | Not Supported | Not Supported for Dialog, Eti… |
| St Pierre and Miquelon | PM | +508 | No | --- | --- | Supported | Not Supported | --- |
| St. Kitts and Nevis | KN | +1869 | No | --- | --- | Supported | Not Supported | Supported |
| Sudan | SD | +249 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Suriname | SR | +597 | No | --- | --- | Supported | Supported | --- |
| Swaziland | SZ | +268 | No | Supported | 3 weeks | Not Supported | Not Supported | Not Supported |
| Sweden | SE | +46 | Yes | no table on the page |  |  |  |  |
| Switzerland | CH | +41 | Yes | --- | N/A | Supported | Supported | Supported |
| Syria | SY | +963 | No | Not Supported | N/A | Not Supported | Not Supported | Not Supported |
| Taiwan | TW | +886 | No | Not Supported | N/A | Supported | Not Supported | Supported |
| Tajikistan | TJ | +992 | No | --- | --- | Supported | Not Supported | Supported |
| Tanzania | TZ | +255 | No | Supported / Supported | 4 weeks / 3 weeks | Not Supported for Tigo, Zante… | --- | Not Supported for Tigo, Zante… |
| Thailand | TH | +66 | Yes | Required | 2 weeks | Not Supported | Supported | Not Supported |
| Timor-Leste | TL | +670 | No | Supported for Telkomcel Timor… | 2 Weeks | Not Supported for Telkomcel S… | Not Supported | Not Supported for Telkomcel a… |
| Togo | TG | +228 | No | Not Required | --- | Supported | Supported | --- |
| Tonga | TO | +676 | No | --- | --- | Supported | Not Supported | --- |
| Trinidad and Tobago | TT | +1868 | No | --- | --- | Supported | Not Supported | Not Supported |
| Tunisia | TN | +216 | No | Not Supported / Supported | N/A / 18 days | Supported | --- | Supported |
| Turkey | TR | +90 | No | Supported | 2 weeks | Supported | Not Supported | Supported |
| Turkmenistan | TM | +993 | No | Not Required | --- | Supported | --- | Supported |
| Turks and Caicos Islands | TC | +1649 | No | Not Supported | --- | Supported | Not Supported | Supported |
| Tuvalu | TV | +688 | No | --- | --- | Not Supported | Not Supported | --- |
| Uganda | UG | +256 | No | Supported | 3 weeks | Supported | Not Supported | Supported |
| Ukraine | UA | +380 | No | Not Required | --- | Supported | Not Supported | Supported |
| United Arab Emirates | AE | +971 | No | Supported / Supported | 2 weeks / 2 weeks | Not Supported | --- | Not Supported |
| United Kingdom | GB | +44 | Yes | Required only for Protected S… | N/A | Supported | Supported | Not Supported |
| United States | US | +1 | Yes | Not Supported | --- | Not Supported | Supported | Not Supported |
| United States Virgin Islands (US) | VI | +1340 | No | --- | --- | Not Supported | Supported | --- |
| Uruguay | UY | +598 | No | Not Supported | N/A | Not Supported | Not Supported | Supported |
| Uzbekistan | UZ | +998 | No | Supported for UCELL | 1 week | Not supported for UCELL Suppo… | --- | Not supported for UCELL Suppo… |
| Vanuatu | VU | +678 | No | --- | --- | Supported | Not Supported | Supported |
| Venezuela | VE | +58 | No | Required | 21 days | Supported | Not Supported | Supported |
| Vietnam | VN | +84 | No | Supported / Supported | 5 weeks / 5 weeks | Not Supported | Not Supported | Supported |
| Yemen | YE | +967 | No | Not Supported | --- | Supported | Not Supported | Not Supported |
| Zambia | ZM | +260 | No | Supported / Supported | 3 weeks / 3 weeks | Supported | Not Supported | Supported |
| Zimbabwe | ZW | +263 | No | Required | 1 week | Not Supported | --- | Supported |
