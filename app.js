import { 
    db, 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    onSnapshot 
} from './firebase.js';

// Elemen UI
const orderForm = document.getElementById('order-form');
const ordersList = document.getElementById('orders-list');
const ordersTable = document.getElementById('orders-table');
const loadingIndicator = document.getElementById('loading');
const connectionStatus = document.getElementById('connection-status');
const syncNotice = document.getElementById('sync-notice');

// Status koneksi
let isOnline = navigator.onLine;

// Update status koneksi
function updateConnectionStatus() {
    isOnline = navigator.onLine;
    if (isOnline) {
        connectionStatus.textContent = 'Online';
        connectionStatus.className = 'status online';
        syncNotice.style.display = 'none';
        console.log("Online: Sinkronisasi data...");
        syncLocalOrders();
    } else {
        connectionStatus.textContent = 'Offline';
        connectionStatus.className = 'status offline';
        syncNotice.style.display = 'block';
        console.log("Offline: Menggunakan data lokal");
    }
}

// Event listeners untuk status koneksi
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

// Fungsi untuk menyimpan order
async function saveOrder(orderData) {
    // Tambahkan timestamp
    orderData.createdAt = new Date().toISOString();
    
    if (isOnline) {
        try {
            // Simpan ke Firestore
            const docRef = await addDoc(collection(db, "orders"), orderData);
            console.log("Order tersimpan di Firestore dengan ID: ", docRef.id);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error("Error menyimpan ke Firestore: ", error);
            // Fallback ke localStorage
            return saveToLocalStorage(orderData);
        }
    } else {
        // Simpan ke localStorage
        return saveToLocalStorage(orderData);
    }
}

// Fungsi untuk menyimpan ke localStorage
function saveToLocalStorage(orderData) {
    try {
        // Generate ID unik
        const id = 'local_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
        orderData.id = id;
        orderData.isLocal = true;
        
        // Ambil orders yang ada
        const orders = JSON.parse(localStorage.getItem('rafaelax_orders') || '[]');
        
        // Tambahkan order baru
        orders.push(orderData);
        
        // Simpan kembali ke localStorage
        localStorage.setItem('rafaelax_orders', JSON.stringify(orders));
        
        console.log("Order tersimpan di localStorage dengan ID: ", id);
        return { success: true, id, isLocal: true };
    } catch (error) {
        console.error("Error menyimpan ke localStorage: ", error);
        return { success: false, error };
    }
}

// Fungsi untuk mengambil orders
async function fetchOrders() {
    if (isOnline) {
        try {
            // Setup real-time listener
            const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
                const orders = [];
                snapshot.forEach((doc) => {
                    orders.push({ id: doc.id, ...doc.data() });
                });
                
                // Gabungkan dengan data lokal jika ada
                const localOrders = getLocalOrders();
                const mergedOrders = [...orders, ...localOrders];
                
                displayOrders(mergedOrders);
            });
            
            return () => unsubscribe(); // Return unsubscribe function
        } catch (error) {
            console.error("Error mengambil data dari Firestore: ", error);
            // Fallback ke localStorage
            const orders = getLocalOrders();
            displayOrders(orders);
            return () => {}; // Return empty function
        }
    } else {
        // Ambil dari localStorage
        const orders = getLocalOrders();
        displayOrders(orders);
        return () => {}; // Return empty function
    }
}

// Fungsi untuk mendapatkan orders dari localStorage
function getLocalOrders() {
    try {
        return JSON.parse(localStorage.getItem('rafaelax_orders') || '[]');
    } catch (error) {
        console.error("Error mengambil data dari localStorage: ", error);
        return [];
    }
}

// Fungsi untuk menghapus order
async function deleteOrder(id) {
    if (id.startsWith('local_')) {
        // Hapus dari localStorage
        const orders = getLocalOrders();
        const filteredOrders = orders.filter(order => order.id !== id);
        localStorage.setItem('rafaelax_orders', JSON.stringify(filteredOrders));
        
        console.log("Order dihapus dari localStorage");
        fetchOrders(); // Refresh list
        return { success: true };
    } else if (isOnline) {
        try {
            // Hapus dari Firestore
            await deleteDoc(doc(db, "orders", id));
            console.log("Order dihapus dari Firestore");
            return { success: true };
        } catch (error) {
            console.error("Error menghapus dari Firestore: ", error);
            return { success: false, error };
        }
    } else {
        // Tandai untuk dihapus nanti ketika online
        try {
            const pendingDeletes = JSON.parse(localStorage.getItem('rafaelax_pending_deletes') || '[]');
            pendingDeletes.push(id);
            localStorage.setItem('rafaelax_pending_deletes', JSON.stringify(pendingDeletes));
            
            // Hapus dari tampilan
            const orders = getLocalOrders();
            const filteredOrders = orders.filter(order => order.id !== id);
            localStorage.setItem('rafaelax_orders', JSON.stringify(filteredOrders));
            
            console.log("Order ditandai untuk dihapus ketika online");
            fetchOrders(); // Refresh list
            return { success: true };
        } catch (error) {
            console.error("Error menandai order untuk dihapus: ", error);
            return { success: false, error };
        }
    }
}

// Fungsi untuk sinkronisasi orders lokal ketika online
async function syncLocalOrders() {
    const localOrders = getLocalOrders();
    const pendingDeletes = JSON.parse(localStorage.getItem('rafaelax_pending_deletes') || '[]');
    
    if (localOrders.length === 0 && pendingDeletes.length === 0) return;
    
    console.log("Memulai sinkronisasi data lokal...");
    
    // Proses penghapusan yang tertunda
    for (const id of pendingDeletes) {
        try {
            await deleteDoc(doc(db, "orders", id));
            console.log("Order terhapus selama offline telah dihapus dari Firestore: ", id);
        } catch (error) {
            console.error("Gagal menghapus order yang tertunda: ", error);
        }
    }
    
    // Hapus daftar pending deletes
    localStorage.removeItem('rafaelax_pending_deletes');
    
    // Proses orders lokal
    for (const order of localOrders) {
        try {
            // Hapus properti lokal sebelum mengirim ke Firestore
            const { id, isLocal, ...orderData } = order;
            
            // Simpan ke Firestore
            await addDoc(collection(db, "orders"), orderData);
            console.log("Order lokal tersinkronisasi ke Firestore: ", order.id);
            
            // Hapus dari localStorage setelah berhasil disinkronisasi
            const updatedLocalOrders = getLocalOrders().filter(o => o.id !== order.id);
            localStorage.setItem('rafaelax_orders', JSON.stringify(updatedLocalOrders));
        } catch (error) {
            console.error("Gagal menyinkronisasi order lokal: ", error);
        }
    }
    
    console.log("Sinkronisasi selesai");
    fetchOrders(); // Refresh list
}

// Fungsi untuk menampilkan orders di UI
function displayOrders(orders) {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (ordersTable) ordersTable.style.display = 'table';
    
    // Kosongkan daftar orders
    ordersList.innerHTML = '';
    
    if (orders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="6" style="text-align: center;">Tidak ada order</td></tr>';
        return;
    }
    
    // Urutkan berdasarkan tanggal (yang terbaru pertama)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Tambahkan setiap order ke daftar
    orders.forEach(order => {
        const profit = order.price - order.hpp;
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${order.customer}</td>
            <td>${order.product}</td>
            <td>Rp ${order.price.toLocaleString('id-ID')}</td>
            <td>Rp ${order.hpp.toLocaleString('id-ID')}</td>
            <td class="profit">Rp ${profit.toLocaleString('id-ID')}</td>
            <td>
                <button class="action-btn delete-btn" data-id="${order.id}">Hapus</button>
            </td>
        `;
        
        ordersList.appendChild(row);
    });
    
    // Tambahkan event listener untuk tombol hapus
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (confirm('Apakah Anda yakin ingin menghapus order ini?')) {
                const result = await deleteOrder(id);
                if (result.success) {
                    console.log("Order dihapus");
                } else {
                    alert('Gagal menghapus order. Silakan coba lagi.');
                }
            }
        });
    });
}

// Event listener untuk form order
orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Ambil nilai dari form
    const customer = document.getElementById('customer').value;
    const product = document.getElementById('product').value;
    const price = parseInt(document.getElementById('price').value);
    const hpp = parseInt(document.getElementById('hpp').value);
    
    // Validasi
    if (price <= hpp) {
        alert('Harga jual harus lebih tinggi dari HPP!');
        return;
    }
    
    // Buat objek order
    const orderData = { customer, product, price, hpp };
    
    // Simpan order
    const result = await saveOrder(orderData);
    
    if (result.success) {
        // Reset form
        orderForm.reset();
        console.log("Order tersimpan");
        
        // Refresh daftar order
        fetchOrders();
    } else {
        alert('Gagal menyimpan order. Silakan coba lagi.');
    }
});

// Inisialisasi aplikasi
let unsubscribeFunction = () => {};

async function initApp() {
    // Setup real-time listener untuk orders
    unsubscribeFunction = await fetchOrders();
}

// Jalankan aplikasi
initApp();
