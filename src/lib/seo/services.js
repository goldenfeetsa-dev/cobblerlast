/**
 * صفحات الخدمات التفصيلية (هبوط لكل نية بحث) — عربي + إنجليزي.
 * القاعدة: كل معلومة هنا موجودة فعلاً بصفحات الموقع/النظام (خيارات الخدمات
 * بصفحة الطلب، سياسة الإصلاح، الأسعار المنشورة). ما فيه سعر أو مدة لخدمة
 * ما هي منشورة. الأسعار "من 80/150/50" فقط حيث الموقع ينشرها أصلاً.
 */
const POLICY_AR = 'تُفحص القطعة عند الاستلام وتُوثَّق بالصور، ويصلك تقرير مبدئي خلال 24 ساعة، ولا يبدأ أي عمل قبل موافقتك الصريحة على السعر.';
const POLICY_EN = 'Every item is inspected and photographed on arrival, you receive an initial report within 24 hours, and no work starts without your explicit approval of the price.';

export const SERVICE_PAGES = [
  {
    slug: 'shoe-repair',
    ar: {
      name: 'إصلاح الأحذية', title: 'تصليح احذية الرياض | اصلاح وترميم الأحذية الجلدية',
      description: 'اسكافي بالرياض لإصلاح وترميم الأحذية الجلدية: تغيير نعل وكعب وبطانة، خياطة ولصق، توسيع، تلميع وتلوين. استلام من موقعك وضمان 30 يوماً.',
      h1: 'تصليح احذية في الرياض — إصلاح وترميم الأحذية الجلدية',
      intro: 'في إبرة وخيط الإسكافي نصلح الأحذية الجلدية الرسمية والنسائية والرياضية بأيدي حرفيين سعوديين، من تغيير النعل والكعب إلى ترميم الجلد وتجديد اللون. نستلم حذاءك من موقعك داخل الرياض ونعيده بضمان 30 يوماً.',
      covers: ['تغيير النعل (التنعيل) والدعسات', 'تغيير وتصليح الكعب', 'تغيير البطانة', 'الخياطة واللصق بالغراء', 'توسيع الحذاء الضيق', 'تغيير الجلد وترميم الجلد التالف', 'التلميع والتلوين', 'التنظيف والصيانة العامة'],
      extra: 'الأسعار تبدأ من 80 ريال لترميم الأحذية و50 ريال للتلميع والتلوين، والسعر النهائي بعد فحص الحذاء. تلميع الأحذية يستغرق من يوم إلى يومين، والترميم البسيط من 3 إلى 5 أيام.',
      faq: [
        { q: 'كم سعر تصليح الحذاء؟', a: 'ترميم الأحذية يبدأ من 80 ريال والتلميع والتلوين من 50 ريال، ويُحدَّد السعر النهائي بعد فحص الحذاء وبموافقتك.' },
        { q: 'هل تغيّرون النعل والكعب؟', a: 'نعم، نغيّر النعل والكعب ونصلحهما، ونغيّر البطانة ونوسّع الأحذية الضيقة.' },
      ],
    },
    en: {
      name: 'Shoe repair', title: 'Shoe Repair Riyadh | Leather Shoe Restoration',
      description: 'Riyadh cobbler for leather shoe repair: sole, heel and lining replacement, stitching, stretching, polishing and recoloring. Pickup and 30-day guarantee.',
      h1: 'Shoe Repair in Riyadh — Leather Shoe Restoration',
      intro: 'At Ebra & Khait Cobbler, Saudi craftsmen repair formal, women’s and sports shoes — from new soles and heels to leather restoration and recoloring. We collect your shoes from your location in Riyadh and return them with a 30-day guarantee.',
      covers: ['Sole replacement and re-soling', 'Heel replacement and repair', 'Lining replacement', 'Stitching and gluing', 'Stretching tight shoes', 'Leather replacement and restoration', 'Polishing and recoloring', 'Cleaning and general maintenance'],
      extra: 'Prices start from SAR 80 for shoe restoration and SAR 50 for polishing and recoloring; the final price is set after inspection. Polishing takes 1–2 days and simple restoration 3–5 days.',
      faq: [
        { q: 'How much does shoe repair cost?', a: 'Shoe restoration starts from SAR 80 and polishing and recoloring from SAR 50. The final price is confirmed after inspection and only with your approval.' },
        { q: 'Do you replace soles and heels?', a: 'Yes. We replace and repair soles and heels, replace linings and stretch tight shoes.' },
      ],
    },
  },
  {
    slug: 'bag-repair',
    ar: {
      name: 'إصلاح الشنط والحقائب', title: 'تصليح شنط الرياض | اصلاح وترميم الحقائب الجلدية',
      description: 'تصليح وترميم الشنط والحقائب الجلدية بالرياض: سحاب، هندل، قاعدة، تغيير جلد وتلبيس، صبغ وتلميع. استلام من موقعك وضمان 30 يوماً.',
      h1: 'تصليح شنط في الرياض — إصلاح وترميم الحقائب الجلدية',
      intro: 'نصلح وننظف ونجدد الشنط والحقائب الجلدية بكل أنواعها: من تغيير السحاب والهندل إلى تغيير الجلد والتلبيس وتجديد اللون. نستلم الحقيبة من موقعك في الرياض ونتابع معك كل مرحلة.',
      covers: ['تغيير السحاب (جزئي أو كامل)', 'صيانة وتغيير الهندل واليد', 'تصليح القاعدة وتثبيتها', 'تغيير الجلد والتلبيس', 'الصبغ والتلوين وتجديد اللون', 'الخياطة واللصق', 'تصليح القفل والمفتاح', 'التنظيف والتغليف'],
      extra: 'تجديد الحقائب الجلدية يبدأ من 150 ريال، والسعر النهائي يُحدَّد بعد فحص الحقيبة. الترميم الشامل يستغرق من 7 إلى 14 يوماً.',
      faq: [
        { q: 'هل تصلحون سحاب الشنطة؟', a: 'نعم، نغيّر السحاب كاملاً أو نصلحه، ونصلح الهندل والقاعدة والقفل.' },
        { q: 'كم يستغرق ترميم الحقيبة؟', a: 'الترميم البسيط من 3 إلى 5 أيام والشامل من 7 إلى 14 يوماً، وقد تطول المدة في الحالات المعقدة.' },
      ],
    },
    en: {
      name: 'Bag repair', title: 'Bag Repair Riyadh | Leather Handbag Restoration',
      description: 'Leather bag and handbag repair in Riyadh: zippers, handles, base, leather replacement and re-covering, dyeing and polishing. Pickup and a 30-day guarantee.',
      h1: 'Bag Repair in Riyadh — Leather Handbag Restoration',
      intro: 'We repair, clean and renew leather bags and handbags of every kind — from replacing zippers and handles to new leather, re-covering and recoloring. We collect the bag from your location in Riyadh and keep you updated at every stage.',
      covers: ['Zipper replacement (partial or full)', 'Handle maintenance and replacement', 'Base repair and reinforcement', 'Leather replacement and re-covering', 'Dyeing, recoloring and renewal', 'Stitching and gluing', 'Lock and key repair', 'Cleaning and wrapping'],
      extra: 'Leather bag renewal starts from SAR 150; the final price is set after inspection. Full restoration takes 7–14 days.',
      faq: [
        { q: 'Can you replace a bag zipper?', a: 'Yes. We replace the full zipper or repair it, and we also fix handles, bases and locks.' },
        { q: 'How long does a bag restoration take?', a: 'Simple restoration takes 3–5 days and full restoration 7–14 days; complex cases can take longer.' },
      ],
    },
  },
  {
    slug: 'travel-bag-repair',
    ar: {
      name: 'إصلاح شنط السفر', title: 'تصليح شنط السفر الرياض | عجلات وسحاب وهندل',
      description: 'اصلاح شنط سفر بالرياض: تغيير عجلات وسحاب كامل وهندل وقفل ومفتاح، وصيانة شاملة لحقائب السفر. استلام من موقعك وضمان 30 يوماً.',
      h1: 'اصلاح شنط سفر في الرياض — عجلات وسحاب وهندل',
      intro: 'قبل سفرتك القادمة لا ترمي شنطتك: نصلح شنط وحقائب السفر من تغيير العجلات والسحاب الكامل إلى الهندل والقفل والمفتاح. نستلم الحقيبة من موقعك داخل الرياض.',
      covers: ['تغيير العجلات', 'تغيير السحاب كاملاً', 'صيانة وتغيير الهندل', 'تصليح القفل والمفتاح', 'تثبيت وتصليح القاعدة', 'الخياطة واللصق', 'التغليف والتنظيف'],
      extra: 'ننبهك بالسعر بعد فحص الحقيبة ولا نبدأ قبل موافقتك. للطلبات التي تتجاوز 300 ريال يُطلب 50% مقدماً.',
      faq: [
        { q: 'هل تغيّرون عجلات شنطة السفر؟', a: 'نعم، نغيّر العجلات ونصلح السحاب والهندل والقفل في شنط السفر.' },
        { q: 'هل يمكن استلام الشنطة من موقعي؟', a: 'نعم، مندوبنا يستلم القطعة من موقعك داخل الرياض.' },
      ],
    },
    en: {
      name: 'Travel bag repair', title: 'Travel Bag & Suitcase Repair Riyadh | Wheels & Zippers',
      description: 'Travel bag and suitcase repair in Riyadh: wheel replacement, full zipper replacement, handles, locks and keys. Pickup from your location and a 30-day guarantee.',
      h1: 'Travel Bag & Suitcase Repair in Riyadh',
      intro: 'Before your next trip, don’t throw your bag away: we repair travel bags and suitcases — wheels, full zippers, handles, locks and keys. We collect the bag from your location inside Riyadh.',
      covers: ['Wheel replacement', 'Full zipper replacement', 'Handle maintenance and replacement', 'Lock and key repair', 'Base repair and reinforcement', 'Stitching and gluing', 'Wrapping and cleaning'],
      extra: 'We quote the price after inspecting the bag and never start before your approval. A 50% deposit applies to orders above SAR 300.',
      faq: [
        { q: 'Can you replace suitcase wheels?', a: 'Yes. We replace wheels and repair zippers, handles and locks on travel bags.' },
        { q: 'Can you pick the bag up from my location?', a: 'Yes, our courier collects the item from your location in Riyadh.' },
      ],
    },
  },
  {
    slug: 'luxury-bag-repair',
    ar: {
      name: 'ترميم حقائب الماركات الفاخرة', title: 'صيانة شنط LV وهيرمس وشانيل | ترميم الماركات - الرياض',
      description: 'ترميم وصيانة حقائب الماركات الفاخرة بالرياض: لويس فيتون (LV)، هيرمس، شانيل، غوتشي، ديور. تجديد الجلد واللون والمقابض بأيدي حرفيين سعوديين.',
      h1: 'صيانة شنط LV وترميم حقائب الماركات الفاخرة في الرياض',
      intro: 'حقيبتك الفاخرة تستحق يد حرفي متخصص. نرمّم ونجدد حقائب لويس فيتون (LV) وهيرمس وشانيل وغوتشي وديور ودولتشي آند غابانا: تنظيف، إصلاح الخياطة، تجديد اللون، وتغيير المقابض. كل قطعة تُوثَّق بالصور قبل بدء أي عمل.',
      covers: ['صيانة وترميم شنط لويس فيتون (LV)', 'ترميم شنط هيرمس', 'ترميم شنط شانيل', 'ترميم حقائب غوتشي وديور ودولتشي آند غابانا', 'تجديد الألوان والجلد', 'إصلاح الخياطة والمقابض', 'تنظيف وتجديد شامل'],
      extra: POLICY_AR + ' القطع ذات القيمة العالية جداً قد تستغرق تقييماً أطول.',
      faq: [
        { q: 'هل تصلحون شنط لويس فيتون (LV)؟', a: 'نعم، نرمّم ونجدد حقائب لويس فيتون، وكذلك هيرمس وشانيل وغوتشي وديور.' },
        { q: 'كيف تتعاملون مع القطع الغالية؟', a: 'تُفحص القطعة عند الاستلام وتُوثَّق بالصور، ولا يبدأ العمل قبل موافقتك على السعر، ونحتفظ بالحق في رفض ترميم قد يضر بالقطعة أكثر مما ينفعها.' },
      ],
    },
    en: {
      name: 'Luxury bag restoration', title: 'Louis Vuitton, Hermès & Chanel Bag Repair — Riyadh',
      description: 'Luxury bag restoration in Riyadh: Louis Vuitton (LV), Hermès, Chanel, Gucci, Dior. Leather, colour and handle renewal by Saudi craftsmen.',
      h1: 'Luxury Bag Repair in Riyadh — Louis Vuitton (LV), Hermès, Chanel',
      intro: 'Your luxury bag deserves a specialist’s hands. We restore and renew Louis Vuitton (LV), Hermès, Chanel, Gucci, Dior and Dolce & Gabbana bags: cleaning, stitching repair, colour renewal and handle replacement. Every piece is photographed before any work begins.',
      covers: ['Louis Vuitton (LV) bag repair and restoration', 'Hermès bag restoration', 'Chanel bag restoration', 'Gucci, Dior and Dolce & Gabbana bags', 'Colour and leather renewal', 'Stitching and handle repair', 'Deep cleaning and full renewal'],
      extra: POLICY_EN + ' Very high-value pieces may need a longer assessment.',
      faq: [
        { q: 'Do you repair Louis Vuitton (LV) bags?', a: 'Yes. We restore and renew Louis Vuitton bags, as well as Hermès, Chanel, Gucci and Dior.' },
        { q: 'How do you handle expensive pieces?', a: 'Each piece is inspected and photographed on arrival, no work starts without your approval of the price, and we reserve the right to decline a restoration that could harm the piece more than help it.' },
      ],
    },
  },
  {
    slug: 'military-boots-repair',
    ar: {
      name: 'إصلاح البسطار العسكري', title: 'اصلاح بسطار عسكري الرياض | تغيير نعل وخياطة',
      description: 'تصليح البسطار العسكري بالرياض: تغيير النعل، الخياطة، التلميع، وصيانة شاملة للبسطار والبوت الجلد. استلام من موقعك وضمان 30 يوماً.',
      h1: 'اصلاح بسطار عسكري في الرياض — تغيير نعل وخياطة',
      intro: 'البسطار العسكري يتعب مع الاستخدام، ونرجّعه جاهزاً: نبدّل النعل ونخيط ونصلح ونلمّع ونجري صيانة شاملة للبسطار والأحذية الرياضية. نستلم من موقعك داخل الرياض.',
      covers: ['تبديل نعل البسطار', 'خياطة التمزقات', 'صيانة شاملة', 'تلميع وتلوين الجلد', 'تغيير البطانة', 'تنظيف وتجديد البوت الجلد'],
      extra: 'السعر النهائي بعد فحص البسطار وبموافقتك، وجميع الأعمال مضمونة 30 يوماً.',
      faq: [
        { q: 'هل تصلحون البسطار العسكري؟', a: 'نعم، نبدّل نعل البسطار العسكري ونخيطه ونصلحه ونجري له صيانة شاملة.' },
        { q: 'هل يشمل الضمان إصلاح البسطار؟', a: 'نعم، جميع أعمال الإصلاح مضمونة 30 يوماً من تاريخ الاستلام.' },
      ],
    },
    en: {
      name: 'Military boots repair', title: 'Military Boots Repair Riyadh | Resoling & Stitching',
      description: 'Military boot repair in Riyadh: new soles, stitching, polishing and full maintenance for combat boots and leather boots. Pickup and a 30-day guarantee.',
      h1: 'Military Boots Repair in Riyadh — Resoling & Stitching',
      intro: 'Military boots take a beating, and we get them ready again: new soles, stitching, repairs, polishing and full maintenance for boots and sports shoes. We collect from your location inside Riyadh.',
      covers: ['Boot sole replacement', 'Stitching torn seams', 'Full maintenance', 'Leather polishing and recoloring', 'Lining replacement', 'Cleaning and renewing leather boots'],
      extra: 'The final price is set after inspecting the boots and with your approval; all work is guaranteed for 30 days.',
      faq: [
        { q: 'Do you repair military boots?', a: 'Yes. We resole, stitch, repair and fully service military boots.' },
        { q: 'Is boot repair covered by the guarantee?', a: 'Yes. All repair work is guaranteed for 30 days from pickup.' },
      ],
    },
  },
  {
    slug: 'sneaker-repair',
    ar: {
      name: 'تصليح الأحذية الرياضية', title: 'تصليح احذية رياضية وكوتشي الرياض | تنظيف وصيانة',
      description: 'تصليح الأحذية الرياضية (الكوتشي) بالرياض: تبديل النعل، خياطة، لصق، تنظيف وصيانة شاملة. استلام من موقعك وضمان 30 يوماً.',
      h1: 'تصليح احذية رياضية في الرياض — تبديل نعل وتنظيف',
      intro: 'حذاؤك الرياضي المفضل يستاهل فرصة ثانية: نبدّل النعل ونخيط ونلصق وننظف ونصلح الأحذية الرياضية (الكوتشي) بأيدي حرفية.',
      covers: ['تبديل النعل', 'الخياطة واللصق', 'تنظيف الحذاء الرياضي', 'تلميع وتلوين', 'صيانة شاملة'],
      extra: 'السعر بعد الفحص وبموافقتك، والضمان 30 يوماً على الإصلاح.',
      faq: [{ q: 'هل تصلحون الأحذية الرياضية (الكوتشي)؟', a: 'نعم، نبدّل نعل الأحذية الرياضية ونصلحها وننظفها.' }],
    },
    en: {
      name: 'Sneaker repair', title: 'Sneaker Repair & Cleaning Riyadh | Sports Shoes',
      description: 'Sneaker and sports-shoe repair in Riyadh: sole replacement, stitching, gluing, cleaning and full maintenance. Pickup and a 30-day guarantee.',
      h1: 'Sneaker Repair & Cleaning in Riyadh',
      intro: 'Your favourite sneakers deserve a second chance: we replace soles, stitch, glue, clean and repair sports shoes by hand.',
      covers: ['Sole replacement', 'Stitching and gluing', 'Sneaker cleaning', 'Polishing and recoloring', 'Full maintenance'],
      extra: 'Price after inspection and with your approval; repairs carry a 30-day guarantee.',
      faq: [{ q: 'Do you repair sneakers?', a: 'Yes. We replace soles on sports shoes and repair and clean them.' }],
    },
  },
  {
    slug: 'leather-polish-dye',
    ar: {
      name: 'تلميع وتلوين الجلود', title: 'تلميع وتلوين احذية وشنط جلد الرياض | صبغ الجلد',
      description: 'تلميع وصبغ وتلوين الأحذية والشنط الجلدية بالرياض: ألوان ثابتة وتقنيات أوروبية لإعادة اللون والبريق الأصلي. تبدأ من 50 ريال.',
      h1: 'تلميع وتلوين الجلد في الرياض — صبغ احذية وشنط جلد',
      intro: 'الجلد يبهت ويتقشر مع الوقت، ونرجّع له لونه وبريقه بألوان ثابتة وعميقة وتقنيات أوروبية حديثة، للأحذية والحقائب الجلدية.',
      covers: ['تلميع الأحذية', 'صبغ وتلوين الأحذية الجلد', 'صبغ وتلوين الشنط الجلد', 'تجديد لون الجلد', 'تنظيف قبل التلوين'],
      extra: 'التلميع والتلوين يبدأ من 50 ريال، وتلميع الأحذية من يوم إلى يومين. السعر النهائي بعد فحص القطعة.',
      faq: [
        { q: 'كم سعر تلميع وتلوين الحذاء؟', a: 'يبدأ من 50 ريال، ويُحدَّد السعر النهائي بعد فحص القطعة.' },
        { q: 'هل تصبغون الشنط الجلد؟', a: 'نعم، نصبغ ونلوّن الأحذية والشنط الجلد ونجدد ألوانها.' },
      ],
    },
    en: {
      name: 'Leather polishing & dyeing', title: 'Leather Polishing & Dyeing Riyadh | Shoes & Bags',
      description: 'Leather polishing, dyeing and recoloring for shoes and bags in Riyadh: lasting colours and European techniques to restore the original shine. From SAR 50.',
      h1: 'Leather Polishing & Dyeing in Riyadh',
      intro: 'Leather fades and cracks over time. We bring back colour and shine with deep, lasting colours and modern European techniques for leather shoes and bags.',
      covers: ['Shoe polishing', 'Leather shoe dyeing and recoloring', 'Leather bag dyeing and recoloring', 'Colour renewal', 'Cleaning before recoloring'],
      extra: 'Polishing and recoloring starts from SAR 50; shoe polishing takes 1–2 days. The final price is set after inspection.',
      faq: [
        { q: 'How much does leather polishing and dyeing cost?', a: 'It starts from SAR 50; the final price is set after inspecting the item.' },
        { q: 'Can you dye leather bags?', a: 'Yes. We dye and recolor leather shoes and bags and renew their colours.' },
      ],
    },
  },
  {
    slug: 'sole-replacement',
    ar: {
      name: 'تغيير نعال الأحذية', title: 'تغيير نعل حذاء الرياض | تنعيل وتغيير كعب',
      description: 'تغيير نعل وكعب الأحذية بالرياض (تنعيل): للأحذية الجلد والرسمية والنسائية والبسطار. استلام من موقعك وضمان 30 يوماً.',
      h1: 'تغيير نعل حذاء في الرياض — تنعيل وتغيير كعب',
      intro: 'النعل المتآكل لا يعني نهاية الحذاء. نغيّر النعل والكعب للأحذية الجلدية والرسمية والنسائية والبسطار، ونخيط ونلصق بما يناسب كل حذاء.',
      covers: ['تغيير النعل (التنعيل)', 'تغيير الكعب', 'الدعسات', 'الخياطة بعد التنعيل', 'اللصق بالغراء'],
      extra: 'ترميم الأحذية يبدأ من 80 ريال، والترميم البسيط من 3 إلى 5 أيام.',
      faq: [{ q: 'كم سعر تغيير نعل الحذاء؟', a: 'ترميم الأحذية يبدأ من 80 ريال، ويُحدَّد السعر النهائي بعد فحص الحذاء وبموافقتك.' }],
    },
    en: {
      name: 'Sole replacement', title: 'Shoe Sole Replacement Riyadh | Resoling & Heels',
      description: 'Sole and heel replacement for leather, formal and women’s shoes and boots in Riyadh. Pickup from your location and a 30-day guarantee.',
      h1: 'Shoe Sole Replacement in Riyadh — Resoling & Heels',
      intro: 'A worn sole doesn’t mean the end of the shoe. We replace soles and heels on leather, formal and women’s shoes and boots, with stitching and gluing suited to each pair.',
      covers: ['Sole replacement (resoling)', 'Heel replacement', 'Sole and heel taps', 'Stitching after resoling', 'Gluing'],
      extra: 'Shoe restoration starts from SAR 80; simple restoration takes 3–5 days.',
      faq: [{ q: 'How much does sole replacement cost?', a: 'Shoe restoration starts from SAR 80; the final price is set after inspection and with your approval.' }],
    },
  },
  {
    slug: 'school-bag-repair',
    ar: {
      name: 'إصلاح الشنط المدرسية', title: 'تصليح شنط مدرسية وشنط ظهر الرياض | سحاب وخياطة',
      description: 'اصلاح الشنط المدرسية وشنط الظهر بالرياض: تغيير السحاب، الخياطة، تصليح الأحزمة والهندل. قبل المدرسة لا ترمي الشنطة، صلّحها.',
      h1: 'تصليح شنط مدرسية وشنط ظهر في الرياض',
      intro: 'شنطة المدرسة أو الظهر انقطع سحابها أو تمزقت خياطتها؟ نصلحها بدل شراء جديدة: تغيير السحاب والخياطة وتصليح الأحزمة واليد.',
      covers: ['تغيير السحاب', 'الخياطة وتثبيت التمزقات', 'تصليح اليد والهندل', 'اللصق', 'تثبيت القاعدة'],
      extra: 'السعر بعد فحص الشنطة وبموافقتك، وجميع الأعمال مضمونة 30 يوماً.',
      faq: [{ q: 'هل تصلحون الشنط المدرسية؟', a: 'نعم، نصلح الشنط المدرسية وشنط الظهر: السحاب والخياطة والهندل.' }],
    },
    en: {
      name: 'School bag repair', title: 'School Bag & Backpack Repair Riyadh | Zippers & Stitching',
      description: 'School bag and backpack repair in Riyadh: zipper replacement, stitching, straps and handles. Don’t replace it — repair it.',
      h1: 'School Bag & Backpack Repair in Riyadh',
      intro: 'Zipper broken or seams torn on a school bag or backpack? We repair it instead of buying a new one: zipper replacement, stitching, straps and handles.',
      covers: ['Zipper replacement', 'Stitching and reinforcing tears', 'Handle and strap repair', 'Gluing', 'Base reinforcement'],
      extra: 'Price after inspecting the bag and with your approval; all work is guaranteed for 30 days.',
      faq: [{ q: 'Do you repair school bags?', a: 'Yes. We repair school bags and backpacks — zippers, stitching and handles.' }],
    },
  },
];
export const serviceBySlug = (slug) => SERVICE_PAGES.find((s) => s.slug === slug);
