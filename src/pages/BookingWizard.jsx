import { useTrackVisit } from '@/hooks/useTrackVisit';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseApi';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Scissors } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import StepIndicator from '@/components/booking/StepIndicator';
import ServiceSelector from '@/components/booking/ServiceSelector';
import CalendarPicker from '@/components/booking/CalendarPicker';
import BookingTypeSelector from '@/components/booking/BookingTypeSelector';
import LiveInvoice from '@/components/booking/LiveInvoice';
import CustomerForm from '@/components/booking/CustomerForm';
import BookingConfirmation from '@/components/booking/BookingConfirmation';
import ItemPhotosUploader from '@/components/booking/ItemPhotosUploader';

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
    if (!customer.name.trim()) errs.name = 'الاسم مطلوب';
    if (!customer.phone.trim()) errs.phone = 'رقم الجوال مطلوب';
    else if (!/^05\d{8}$/.test(customer.phone.trim())) errs.phone = 'رقم الجوال غير صحيح (يبدأ بـ 05)';
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

    const created = await base44.entities.Booking.create(bookingData);
    qc.invalidateQueries({ queryKey: ['bookings-calendar'] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
    setConfirmedBooking(created);
    setSubmitting(false);
    setStep(5);
  };

  if (step === 5 && confirmedBooking) {
    return (
      <div className="min-h-screen bg-stone-50 py-8 px-4" dir="rtl">
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-8">
          <BookingConfirmation booking={confirmedBooking} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/booking" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-700 text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            العودة للموقع
          </Link>
          <h1 className="text-2xl font-black text-stone-800 flex items-center justify-center gap-2">
            <Scissors className="w-6 h-6 text-amber-500" />
            حجز موعد جديد
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
                    onTypeChange={t => { setBookingType(t); setAddress(''); setLocation(null); }}
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
                <h2 className="text-xl font-bold text-stone-800 mb-1">مراجعة الحجز</h2>
                <p className="text-stone-500 text-sm mb-6">تأكد من البيانات قبل الإتمام</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">الخدمة</span>
                    <span className="font-bold text-stone-800">{service?.name_ar}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">الموعد</span>
                    <span className="font-bold text-stone-800">
                      {selectedDate && format(selectedDate, 'yyyy/MM/dd')} — {selectedTime}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">نوع الخدمة</span>
                    <span className="font-bold text-stone-800">{bookingType === 'home_visit' ? 'زيارة منزلية' : 'استلام من المحل'}</span>
                  </div>
                  {address && (
                    <div className="flex justify-between py-2 border-b border-stone-100">
                      <span className="text-stone-500">العنوان</span>
                      <span className="font-bold text-stone-800">{address}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">الاسم</span>
                    <span className="font-bold text-stone-800">{customer.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-stone-100">
                    <span className="text-stone-500">الجوال</span>
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
                <ArrowRight className="w-4 h-4" />
                السابق
              </Button>
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold gap-2"
                >
                  التالي
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold px-8"
                >
                  {submitting ? 'جارٍ الحجز...' : 'تأكيد الحجز'}
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
                    <p className="font-bold text-amber-800 mb-1">موعدك المختار</p>
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