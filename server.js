require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// ── Kêt nối MongoDB The Atlas ───────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('LỖI MẠNG: Bạn chưa điền MONGODB_URI trong file .env');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Đã kết nối thành công MongoDB Atlas!'))
  .catch((err) => console.log('❌ Lỗi kết nối DB:', err));

// ── Định Nghĩa Schema (Bản vẽ cấu trúc Database) ───────────────────
// Mỗi "Trip" sẽ có Tên, Người tạo, Danh sách thành viên, và Lịch sử thu chi
const tripSchema = new mongoose.Schema({
  title: { type: String, default: 'Chuyến đi Mới' },
  creatorId: { type: String },
  members: { type: [String], default: [] },
  bankName: String,
  bankAccount: String,
  bankQrUrl: String,
  expenses: [{
    id: String, // Dung timestamp de lam ID nhanh
    name: String,
    amount: Number,
    payerId: String,
    participantIds: [String]
  }]
}, { timestamps: true });

// Do client Zalo xài trường "id" thay vì "_id" của mongo
tripSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
});

const Trip = mongoose.model('Trip', tripSchema);

// ── Định Nghĩa Các Route API Mới Bằng Mongoose ─────────────────────

// API: Tạo chuyến đi chơi mới
app.post('/api/trips', async (req, res) => {
  try {
    const { title, creatorId } = req.body;
    const newTrip = new Trip({
      title: title || 'Buổi đi chơi mới',
      creatorId,
      members: [],
      expenses: []
    });
    const savedTrip = await newTrip.save();
    res.status(201).json(savedTrip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Lấy chi tiết chuyến đi chơi
app.get('/api/trips/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Không tìm thấy chuyến đi' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: 'Mã chuyến đi không hợp lệ' });
  }
});

// API: Cập nhật thông tin (Thêm thành viên, rename, v.v.)
app.put('/api/trips/:id', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!trip) return res.status(404).json({ message: 'Không tìm thấy chuyến đi' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Thêm 1 khoản chi mới vào Mảng expenses của Trip
app.post('/api/trips/:id/expenses', async (req, res) => {
  try {
    const newExpense = {
      id: Date.now().toString(),
      ...req.body // name, amount, payerId, participantIds
    };
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { $push: { expenses: newExpense } },
      { new: true }
    );
    if (!trip) return res.status(404).json({ message: 'Không tìm thấy chuyến đi' });
    res.status(201).json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook API dành cho Zalo Mini App ───────────────────────────────
// API này nhận Webhook từ Zalo (ví dụ: tracking users, zma notifications)
app.post('/api/zalo/webhook', async (req, res) => {
  try {
    const eventData = req.body;
    
    // Log toàn bộ dữ liệu do Zalo bắn về để tiện theo dõi trên Console của Render
    console.log('📦 [ZALO WEBHOOK] Đã nhận sự kiện từ Zalo:', JSON.stringify(eventData, null, 2));

    // Yêu cầu quan trọng của Zalo: Bắt buộc trả về HTTP 200 OK 
    // trong vòng tối đa 3 giây, nếu không Zalo sẽ tự động gởi đi gởi lại (spam)
    return res.status(200).json({ 
      error: 0,
      message: 'Đã nhận webhook thành công'
    });
  } catch (err) {
    console.error('❌ [ZALO WEBHOOK ERROR]:', err);
    return res.status(500).json({ error: 1, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend chạy tại http://localhost:${PORT}`);
});
