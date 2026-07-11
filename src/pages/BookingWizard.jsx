import { useTrackVisit } from '@/hooks/useTrackVisit';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseApi';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Scissors } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import StepIndicator from '@/components/booking/StepIndicator';
import ServiceSelector from '@/components/booking/ServiceSelector';
import CalendarPicker from '@/components/booking/CalendarPicker';
import BookingTypeSelector from '@/components/booking/BookingTypeSelector';
import LiveInvoice from '@/components/booking/LiveInvoice';
import CustomerForm from '@/components/booking/CustomerForm';
import BookingConfirmation from '@/components/booking/BookingConfirmation';
import ItemPhotosUploader from '@/components/booking/ItemPhotosUploader';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const VAT_RATE = 0.15;

function generateBookingNumber() {
  const prefix = 'BK';
  const date = format(new Date(), 'yyMMdd');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${date}${rand}`;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function BookingWizard() {
  useTrackVisit('/book');
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [bookingType, setBookingType] = useState('in_store');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState(null); // { lat, lng }
  const [itemPhotos, setItemPhotos] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const qc = useQueryClient();

  const canGoNext = () => {
    if (step === 1) return !!service;
    if (step === 2) return !!selectedDate && !!selectedTime && (bookingType === 'in_store' || !!address.trim());
    if (step === 3) return !!customer.name.trim() && !!customer.phone.trim();
    return false;
  };

  const validateStep3 = () => {
    const errs = {};
    if (!customer.name.trim()) errs.name = t('bookingWizard.errors.nameRequired');
    if (!customer.phone.trim()) errs.phone = t('bookingWizard.errors.phoneRequired');
    else if (!/^05\d{8}$/.test(customer.phone.trim())) errs.phone = t('bookingWizard.errors.phoneInvalid');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 3 && !validateStep3()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const deliveryFee = bookingType === 'home_visit' ? 25 : 0;
    const subtotal = (service.price || 0) + deliveryFee;
    const total = +(subtotal * (1 + VAT_RATE)).toFixed(2);
    const endTimeMins = timeToMinutes(selectedTime) + (service.duration_minutes || 30);

    const bookingData = {
      booking_number: generateBookingNumber(),
      customer_name: customer.name.trim(),
      customer_phone: customer.phone.trim(),
      customer_email: customer.email.trim(),
      service_id: service.id,
      service_name: service.name_ar,
      service_price: service.price,
      booking_date: format(selectedDate, 'yyyy-MM-dd'),
      booking_time: selectedTime,
      end_time: minutesToTime(endTimeMins),
      duration_minutes: service.duration_minutes || 30,
      booking_type: bookingType,
      address: bookingType === 'home_visit' ? address.trim() : '',
      latitude: bookingType === 'home_visit' && location ? location.lat : undefined,
      longitude: bookingType === 'home_visit' && location ? location.lng : undefined,
      item_photos: itemPhotos,
      delivery_fee: deliveryFee,
      total_price: total,
      status: 'pending',
      notes: customer.notes.trim(),
    };

    try {
      const created = await base44.entities.Booking.create(bookingData);
      qc.invalidateQueries({ queryKey: ['bookings-calendar'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setConfirmedBooking(created);
      setStep(5);
    } catch (err) {
      toast.error(`تعذّر تأكيد الحجز: ${err.message || 'حاول مرة أخرى'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 5 && confirmedBooking) {
    return (
      <div className="min-h-screen bg-stone-50 py-8 px-4" dir={dir}>
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-8">
          <BookingConfirmation booking={confirmedBooking} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4" dir={dir}>
      <Helmet>
        <title>{isAr ? 'احجز موعد إصلاح | إبرة وخيط الإسكافي — الرياض' : 'Book a Repair Appointment | Ebra & Khait Cobbler — Riyadh'}</title>
        <meta name="description" content={isAr
          ? 'احجز موعدك الآن لإصلاح أو تجديد حذائك أو حقيبتك الجلدية الفاخرة. اختر الخدمة، حدد الموعد، واستلم قطعتك في أفضل حالة — استلام وتوصيل داخل الرياض.'
          : 'Book your appointment now to repair or restore your luxury shoe or leather bag. Choose the service, pick a time, and get your item back in the best condition — pickup and delivery within Riyadh.'} />
        <meta name="keywords" content={isAr
          ? 'حجز موعد إصلاح أحذية, حجز إسكافي الرياض, حجز تجديد حقيبة جلدية, طلب إصلاح حذاء أونلاين, استلام وتوصيل إصلاح أحذية الرياض'
          : 'book shoe repair appointment, book cobbler riyadh, book leather bag renewal, online shoe repair request, shoe repair pickup delivery riyadh'} />
        <link rel="canonical" href="https://needlecobbler.com/book" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={isAr ? 'احجز موعد إصلاح | إبرة وخيط الإسكافي' : 'Book a Repair Appointment | Ebra & Khait Cobbler'} />
        <meta property="og:description" content={isAr ? 'احجز موعدك الآن لإصلاح أو تجديد حذائك أو حقيبتك الجلدية الفاخرة في الرياض.' : 'Book now to repair or restore your luxury shoe or leather bag in Riyadh.'} />
        <meta property="og:url" content="https://needlecobbler.com/book" />
      </Helmet>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link to="/booking" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-700 text-sm">
              <BackIcon className="w-4 h-4" />
              {t('bookingWizard.backHome')}
            </Link>
            <LanguageSwitcher dark={false} />
          </div>
          <h1 className="text-2xl font-black text-stone-800 flex items-center justify-center gap-2">
            <Scissors className="w-6 h-6 text-amber-500" />
            {t('bookingWizard.pageTitle')}
          </h1>
        </div>

        <StepIndicator currentStep={step} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
            {step === 1 && (
              <ServiceSelector selectedService={service} onSelect={setService} />
            )}
            {step === 2 && (
              <div className="space-y-6">
                <CalendarPicker
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onDateChange={setSelectedDate}
                  onTimeChange={setSelectedTime}
                  serviceDuration={service?.duration_minutes || 30}
                />
                <div className="border-t border-stone-100 pt-6">
                  <BookingTypeSelector
                    bookingType={bookingType}
                    address={address}
                    location={location}
                    onTypeChange={tp => { setBookingType(tp); setAddress(''); setLocation(null); }}
                    onAddressChange={setAddress}
                    onLocationChange={setLocation}
                  />
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-6">
                <CustomerForm data={customer} onChange={(k, v) => setCustomer(p => ({ ...p, [k]: v }))} errors={errors} />
                <div className="border-t border-stone-100 pt-6">
                  <ItemPhotosUploader photos={itemPhotos} onChange={setItemPhotos} />
                </div>
              </div>
            )}
            {step === 4 && (
              <div>
                <h2 className="text-xl font-bold text-stone-800 mb-1">{t('bookingWizard.reviewTitle')}</h2>
                <p className="text-stone-500 text-sm mb-6">{t('bookingWizard.reviewDesc')}</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">{t('bookingWizard.service')}</span>
                    <span className="font-bold text-stone-800">{service?.name_ar}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">{t('bookingWizard.date')}</span>
                    <span className="font-bold text-stone-800">
                      {selectedDate && format(selectedDate, 'yyyy/MM/dd')} — {selectedTime}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">{t('bookingWizard.bookingTypeLabel')}</span>
                    <span className="font-bold text-stone-800">{bookingType === 'home_visit' ? t('bookingWizard.homeVisit') : t('bookingWizard.inStore')}</span>
                  </div>
                  {address && (
                    <div className="flex justify-between py-2 border-b border-stone-100">
                      <span className="text-stone-500">{t('bookingWizard.address')}</span>
                      <span className="font-bold text-stone-800">{address}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">{t('bookingWizard.name')}</span>
                    <span className="font-bold text-stone-800">{customer.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">{t('bookingWizard.phone')}</span>
                    <span className="font-bold text-stone-800">{customer.phone}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-stone-100">
              <Button
                variant="outline"
                onClick={() => setStep(s => s - 1)}
                disabled={step === 1}
                className="gap-2"
              >
                <BackIcon className="w-4 h-4" />
                {t('bookingWizard.prev')}
              </Button>
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold gap-2"
                >
                  {t('bookingWizard.next')}
                  {dir === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold px-8"
                >
                  {submitting ? t('bookingWizard.booking') : t('bookingWizard.confirm')}
                </Button>
              )}
            </div>
          </div>

          {/* Live invoice sidebar */}
          <div className="hidden md:block">
            {service && (
              <div className="sticky top-6">
                <LiveInvoice service={service} bookingType={bookingType} />
                {selectedDate && selectedTime && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-right">
                    <p className="font-bold text-amber-800 mb-1">{t('bookingWizard.chosenDate')}</p>
                    <p className="text-amber-700">{format(selectedDate, 'yyyy/MM/dd')} — {selectedTime}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile invoice */}
        {service && (
          <div className="md:hidden mt-4">
            <LiveInvoice service={service} bookingType={bookingType} />
          </div>
        )}
      </div>
    </div>
  );
}
