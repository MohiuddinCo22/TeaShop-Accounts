# দোকানের খাতা

চা ও সিগারেট দোকানের আয়-ব্যয়-লাভের হিসাব রাখার জন্য একজন-অ্যাডমিন ওয়েব অ্যাপ। ডেটা থাকবে Firebase-এ, হোস্টিং হবে GitHub Pages দিয়ে।

## ধাপ ১: Firebase প্রজেক্ট তৈরি করুন

1. https://console.firebase.google.com এ যান, **Add project** দিয়ে নতুন প্রজেক্ট বানান।
2. বাম দিকের মেনু থেকে **Build > Authentication** এ যান > **Get started** > Sign-in method থেকে **Email/Password** চালু করুন।
3. **Authentication > Users** ট্যাবে গিয়ে **Add user** দিয়ে নিজের জন্য একটা ইমেইল ও পাসওয়ার্ড দিয়ে অ্যাকাউন্ট বানান (এটাই হবে অ্যাডমিন লগইন — অ্যাপে সাইন-আপ ফর্ম নেই, তাই শুধু এই অ্যাকাউন্ট দিয়েই ঢোকা যাবে)।
4. বাম মেনু থেকে **Build > Firestore Database** এ গিয়ে **Create database** করুন (production mode)।
5. **Firestore > Rules** ট্যাবে গিয়ে নিচের rule বসিয়ে **Publish** করুন:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /entries/{entryId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

  এতে শুধুমাত্র লগইন করা ব্যবহারকারীই ডেটা পড়তে/লিখতে পারবে। যেহেতু অ্যাপে সাইন-আপ অপশন নেই, শুধু আপনার তৈরি করা অ্যাকাউন্ট দিয়েই কেউ ঢুকতে পারবে।

6. প্রজেক্ট সেটিংসে (⚙️ আইকন > **Project settings**) নিচের দিকে **Your apps** সেকশনে গিয়ে **Web app (</>)** যোগ করুন। এখান থেকে যে `firebaseConfig` অবজেক্ট পাবেন সেটা কপি করুন।

## ধাপ ২: কনফিগ বসান

`js/firebase-config.js` ফাইল খুলে `YOUR_...` জায়গাগুলোতে Firebase থেকে কপি করা মান বসান।

## ধাপ ৩: GitHub-এ আপলোড করুন

```bash
git init
git add .
git commit -m "প্রথম কমিট: দোকানের খাতা অ্যাপ"
git branch -M main
git remote add origin https://github.com/<আপনার-ইউজারনেম>/<রিপোর নাম>.git
git push -u origin main
```

## ধাপ ৪: GitHub Pages দিয়ে চালু করুন

1. GitHub রিপোর **Settings > Pages** এ যান।
2. **Source** থেকে **Deploy from a branch** বেছে নিন, branch: `main`, folder: `/ (root)`, তারপর **Save**।
3. কিছুক্ষণ পর `https://<আপনার-ইউজারনেম>.github.io/<রিপোর-নাম>/` লিংকে অ্যাপটি চালু হয়ে যাবে।

## ধাপ ৫: Firebase-এ ডোমেইন অনুমোদন দিন

Authentication কাজ করার জন্য GitHub Pages এর ডোমেইনটা অনুমোদিত করতে হবে:
- Firebase Console > Authentication > Settings > **Authorized domains** > **Add domain** > `<আপনার-ইউজারনেম>.github.io` যোগ করুন।

## ব্যবহার

- **হোম**: আজকের ও এই মাসের আয়, খরচ ও লাভ; চা vs সিগারেট বিক্রির তুলনা।
- **নতুন এন্ট্রি**: আয় বা খরচ যোগ করুন — বিভাগ, পরিমাণ, তারিখ, নোট দিয়ে।
- **হিসাব খাতা**: মাস ও ধরন অনুযায়ী ফিল্টার করে সব এন্ট্রি দেখুন। যেকোনো এন্ট্রিতে ট্যাপ করলে এডিট বা মুছে ফেলা যায়।

## নতুন বিভাগ (ক্যাটাগরি) যোগ করা

`js/app.js` ফাইলের একদম উপরে `CATEGORIES` অবজেক্টে `income` ও `expense` লিস্টে নতুন নাম যোগ করলেই সেটা ফর্মে দেখা যাবে।
