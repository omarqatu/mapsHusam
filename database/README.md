# database/ — سكربتات SQL

السيرفر بيعمل أغلب الجداول لحاله أول ما يشتغل (`service_requests`، `service_request_messages`، `platform_content`،
`listing_submissions`، `widgets_manual_groups`، `service_ratings`، وأعمدة السعر والمساحة والعملة بـ `service_all`). اللي هون للأشياء اللي
ما بيعملها لحاله — بتنشغّل **مرة وحدة** على قاعدة جديدة، أو لما تضيف طبقة عقارات.

| الملف | متى |
|---|---|
| `update_service_all_trigger.sql` | قاعدة جديدة أو بعد تعديل منطق «متوفر/مسكّر»: بيحسب `auto_status` من الحالة وساعات العمل وتاريخ الانتهاء |
| `add_realestate_layer.sql` | قالب لإضافة طبقة **عقارات** جديدة (كل طبقة عقارات جدول لحاله) |

**الخدمات** ما إلها جدول لكل نوع: كلها بجدول واحد `service_all`، والنوع بعمود `discriminator`. نوع خدمة جديد ما بيحتاج
SQL — الخطوات بـ [`docs/dev/guide.md`](../docs/dev/guide.md).

قاعدة التطوير المحلية (`dev/`) بتتجهّز لحالها بـ `dev/dev.sh db-up`.
