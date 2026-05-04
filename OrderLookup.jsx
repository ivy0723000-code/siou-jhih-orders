import { useState } from "react";
import { db } from "./firebase.js";
import { ref, onValue } from "firebase/database";

const MENU = [
  {id:1,name:"極上·七味唐辛子黃金炸雞餐盒",price:248},
  {id:2,name:"日式琥珀醬秘制燒豚餐盒",price:248},
  {id:3,name:"晨露青花椒鮮麻滑嫩雞餐盒",price:248},
  {id:4,name:"本格派·極厚酥炸熟成豚餐盒",price:258},
  {id:5,name:"招牌黃金蜜桔柑橘柚燒雞餐盒",price:268},
  {id:6,name:"法蘭西·和魂鮮蕃茄濃燉豚角煮餐盒",price:268},
  {id:7,name:"老台味甕漬鳳梨煨金目鱸餐盒",price:288},
  {id:8,name:"完熟紅玉蘋果暖薑蜜燉牛肉餐盒",price:298},
  {id:9,name:"主廚特製德式Q皮香料豬腳餐盒",price:298},
];

const PAY_METHOD = {
  cod:     "貨到付款",
  transfer:"線上轉帳",
  store:   "門市結帳",
};

function cartAmt(cart, customItems, discount, shippingFee) {
  const mAmt = (cart||[]).reduce((s,c)=>{const m=MENU.find(m=>m.id===c.menuId);return s+(m?m.price*c.qty:0);},0);
  const cAmt = (customItems||[]).reduce((s,c)=>s+(Number(c.price)||0)*(Number(c.qty)||1),0);
  const sub = mAmt+cAmt;
  const discounted = discount ? Math.round(sub*(1-Number(discount)/100)) : sub;
  return discounted + Number(shippingFee||0);
}

function fmtDate(s) {
  const d = new Date(s+"T00:00:00");
  return `${d.getFullYear()} / ${d.getMonth()+1} / ${d.getDate()} 週${"日一二三四五六"[d.getDay()]}`;
}

const ORDER_STATUS = {
  confirmed: {label:"已確認", color:"#c8a96e"},
  preparing: {label:"備餐中", color:"#93c5fd"},
  ready:     {label:"可取餐", color:"#6ee7b7"},
  delivered: {label:"已完成", color:"#a78bfa"},
  cancelled: {label:"已取消", color:"#f87171"},
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;700&family=Noto+Sans+TC:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{font-family:'Noto Sans TC',sans-serif;background:#faf7f2;color:#2d2416;min-height:100vh;}

.page{min-height:100vh;background:#faf7f2;display:flex;flex-direction:column;}

/* Header */
.hd{background:#1a2145;padding:0 24px;position:relative;overflow:hidden;}
.hd::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#c8a96e,transparent);}
.hd-inner{max-width:560px;margin:0 auto;padding:20px 0;display:flex;align-items:center;gap:14px;}
.hd-logo{width:48px;height:48px;border-radius:50%;border:1.5px solid #c8a96e;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.hd-title{font-family:'Noto Serif TC',serif;font-size:18px;color:#c8a96e;letter-spacing:3px;font-weight:600;}
.hd-sub{font-size:11px;color:#8a8fa8;letter-spacing:2px;margin-top:2px;}

/* Main */
.main{flex:1;max-width:560px;margin:0 auto;width:100%;padding:32px 20px 60px;}

/* Search box */
.search-wrap{background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 2px 20px rgba(0,0,0,0.07);border:1px solid rgba(200,169,110,0.15);margin-bottom:28px;}
.search-title{font-family:'Noto Serif TC',serif;font-size:16px;color:#1a2145;font-weight:600;margin-bottom:4px;letter-spacing:1px;}
.search-sub{font-size:12px;color:#9ca3af;margin-bottom:18px;}
.search-row{display:flex;gap:10px;}
.phone-inp{flex:1;background:#faf7f2;border:1.5px solid #e5e0d8;border-radius:10px;padding:12px 16px;font-size:15px;font-family:'Noto Sans TC',sans-serif;color:#2d2416;transition:border-color 0.2s;outline:none;}
.phone-inp:focus{border-color:#c8a96e;}
.phone-inp::placeholder{color:#bfb8ae;}
.search-btn{background:linear-gradient(135deg,#c8a96e,#8a6f3e);color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Noto Sans TC',sans-serif;letter-spacing:1px;transition:opacity 0.2s;white-space:nowrap;}
.search-btn:hover{opacity:0.88;}
.search-btn:disabled{opacity:0.5;cursor:default;}

/* Order card */
.order-card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.06);border:1px solid rgba(200,169,110,0.12);margin-bottom:16px;position:relative;overflow:hidden;}
.order-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#c8a96e,#e2c98a,#c8a96e);}

.card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;}
.card-name{font-family:'Noto Serif TC',serif;font-size:18px;font-weight:600;color:#1a2145;}
.card-phone{font-size:13px;color:#9ca3af;margin-top:2px;}
.status-badge{font-size:12px;font-weight:600;border-radius:20px;padding:4px 14px;border:1.5px solid;font-family:'Noto Sans TC',sans-serif;}

.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(200,169,110,0.3),transparent);margin:14px 0;}

/* Info rows */
.info-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;}
.info-icon{font-size:16px;flex-shrink:0;margin-top:1px;}
.info-label{font-size:11px;color:#9ca3af;letter-spacing:0.5px;margin-bottom:1px;}
.info-val{font-size:14px;color:#2d2416;font-weight:500;}

/* Items */
.items-section{background:#faf7f2;border-radius:10px;padding:14px 16px;margin:14px 0;}
.items-title{font-size:11px;color:#8a6f3e;letter-spacing:1px;margin-bottom:10px;font-weight:600;}
.item-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(200,169,110,0.1);}
.item-row:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none;}
.item-name{font-size:13px;color:#2d2416;flex:1;line-height:1.5;}
.item-note{font-size:11px;color:#c8a96e;margin-top:2px;}
.item-qty{font-size:13px;color:#8a6f3e;font-weight:600;flex-shrink:0;}
.item-price{font-size:13px;color:#6b6152;flex-shrink:0;min-width:60px;text-align:right;}

/* Total */
.total-row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:14px;border-top:1.5px solid rgba(200,169,110,0.2);}
.total-label{font-size:13px;color:#9ca3af;}
.total-amt{font-family:'Noto Serif TC',serif;font-size:22px;font-weight:700;color:#1a2145;}
.discount-row{display:flex;justify-content:space-between;font-size:12px;color:#6ee7b7;margin-top:4px;}
.shipping-row{display:flex;justify-content:space-between;font-size:12px;color:#93c5fd;margin-top:4px;}

/* Pay status */
.pay-pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;border-radius:20px;padding:4px 12px;border:1.5px solid;font-weight:600;margin-top:6px;}

/* Empty / error */
.empty{text-align:center;padding:50px 20px;color:#bfb8ae;}
.empty-icon{font-size:40px;margin-bottom:12px;opacity:0.5;}
.empty-text{font-family:'Noto Serif TC',serif;font-size:15px;letter-spacing:1px;}
.empty-sub{font-size:12px;margin-top:6px;}

/* Footer */
.footer{text-align:center;padding:20px;font-size:11px;color:#bfb8ae;letter-spacing:1px;border-top:1px solid rgba(200,169,110,0.1);background:#faf7f2;}

/* Spinner */
.spin{display:inline-block;width:20px;height:20px;border:2px solid rgba(200,169,110,0.3);border-top-color:#c8a96e;border-radius:50%;animation:spin 0.7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
`;

export default function OrderLookup() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  function search() {
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(false);

    // Query both active orders and history
    let activeOrders = [];
    let historyOrders = [];
    let loaded = 0;

    const check = () => {
      loaded++;
      if (loaded < 2) return;
      const all = [...activeOrders, ...historyOrders]
        .filter(o => o.phone && o.phone.replace(/-/g,"").includes(phone.replace(/-/g,"")))
        .sort((a,b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.deliveryTime.localeCompare(a.deliveryTime));
      setOrders(all);
      setLoading(false);
      setSearched(true);
    };

    onValue(ref(db, "siou-jhih/orders"), s => {
      const d = s.val();
      activeOrders = d ? Object.values(d) : [];
      check();
    }, {onlyOnce: true});

    onValue(ref(db, "siou-jhih/history"), s => {
      const d = s.val();
      historyOrders = d ? Object.values(d) : [];
      check();
    }, {onlyOnce: true});
  }

  function handleKey(e) {
    if (e.key === "Enter") search();
  }

  return (
    <div className="page">
      <style>{CSS}</style>

      {/* Header */}
      <header className="hd">
        <div className="hd-inner">
          <div className="hd-logo">
            <span style={{fontFamily:"'Noto Serif TC',serif",fontSize:16,color:"#c8a96e",fontWeight:600}}>秀枝</span>
          </div>
          <div>
            <div className="hd-title">秀枝餐飲事業</div>
            <div className="hd-sub">訂單查詢系統</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main">

        {/* Search */}
        <div className="search-wrap">
          <div className="search-title">查詢我的訂單</div>
          <div className="search-sub">請輸入您的聯絡電話以查詢訂單資訊</div>
          <div className="search-row">
            <input
              className="phone-inp"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={handleKey}
              placeholder="0912-345-678"
              type="tel"
              maxLength={15}
            />
            <button className="search-btn" onClick={search} disabled={loading||!phone.trim()}>
              {loading ? <span className="spin"/> : "查　詢"}
            </button>
          </div>
        </div>

        {/* Results */}
        {searched && orders !== null && (
          orders.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">查無訂單</div>
              <div className="empty-sub">查無此電話的訂單記錄，請確認電話號碼是否正確</div>
            </div>
          ) : (
            <>
              <div style={{fontSize:12,color:"#9ca3af",marginBottom:14,letterSpacing:0.5}}>
                共找到 <strong style={{color:"#c8a96e"}}>{orders.length}</strong> 筆訂單
              </div>
              {orders.map(order => {
                const items = (order.cart||[]).filter(c=>c.qty>0);
                const amt = cartAmt(order.cart, order.customItems, order.discount, order.shippingFee);
                const baseAmt = cartAmt(order.cart, order.customItems, 0, 0);
                const st = ORDER_STATUS[order.status] || ORDER_STATUS.confirmed;
                const pm = PAY_METHOD[order.payMethod] || "貨到付款";

                return (
                  <div key={order.id} className="order-card">

                    {/* Card header */}
                    <div className="card-header">
                      <div>
                        <div className="card-name">{order.customerName}</div>
                        <div className="card-phone">{order.phone}</div>
                      </div>
                      <span className="status-badge" style={{color:st.color,borderColor:st.color+"44",background:st.color+"11"}}>
                        {st.label}
                      </span>
                    </div>

                    <div className="divider"/>

                    {/* Time & Type */}
                    <div className="info-row">
                      <span className="info-icon">📅</span>
                      <div>
                        <div className="info-label">取餐日期</div>
                        <div className="info-val">{fmtDate(order.deliveryDate)}</div>
                      </div>
                    </div>
                    <div className="info-row">
                      <span className="info-icon">🕐</span>
                      <div>
                        <div className="info-label">取餐時間</div>
                        <div className="info-val">{order.deliveryTime}</div>
                      </div>
                    </div>
                    <div className="info-row">
                      <span className="info-icon">{order.type==="delivery"?"🛵":"🏪"}</span>
                      <div>
                        <div className="info-label">取餐方式</div>
                        <div className="info-val">
                          {order.type==="delivery"?"外送":"自取"}
                          {order.posNo&&<span style={{fontSize:12,color:"#c8a96e",marginLeft:8}}>自取單號 #{order.posNo}</span>}
                        </div>
                      </div>
                    </div>
                    {order.type==="delivery" && order.address && (
                      <div className="info-row">
                        <span className="info-icon">📍</span>
                        <div>
                          <div className="info-label">配送地址</div>
                          <div className="info-val">{order.address}</div>
                        </div>
                      </div>
                    )}

                    {/* Tax ID */}
                    {order.taxId && (
                      <div className="info-row">
                        <span className="info-icon">🧾</span>
                        <div>
                          <div className="info-label">統一編號</div>
                          <div className="info-val">{order.taxId}</div>
                        </div>
                      </div>
                    )}

                    <div className="divider"/>

                    {/* Items */}
                    <div className="items-section">
                      <div className="items-title">餐點明細</div>
                      {items.map(c => {
                        const m = MENU.find(m=>m.id===c.menuId);
                        if (!m) return null;
                        return (
                          <div key={c.menuId} className="item-row">
                            <div style={{flex:1}}>
                              <div className="item-name">{m.name}</div>
                              {c.note && <div className="item-note">備註：{c.note}</div>}
                            </div>
                            <div className="item-qty">×{c.qty}</div>
                            <div className="item-price">NT$ {(m.price*c.qty).toLocaleString()}</div>
                          </div>
                        );
                      })}
                      {(order.customItems||[]).filter(c=>c.name||c.price).map((c,i) => (
                        <div key={"ci"+i} className="item-row">
                          <div style={{flex:1}}>
                            <div className="item-name" style={{color:"#8a6f3e"}}>✦ {c.name||"客製餐盒"}</div>
                            {c.note && <div className="item-note">備註：{c.note}</div>}
                          </div>
                          <div className="item-qty">×{c.qty||1}</div>
                          <div className="item-price">NT$ {(Number(c.price||0)*Number(c.qty||1)).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div>
                      {order.discount > 0 && (
                        <div className="discount-row">
                          <span>折扣優惠 {order.discount}% OFF</span>
                          <span>-NT$ {(baseAmt - (amt - Number(order.shippingFee||0))).toLocaleString()}</span>
                        </div>
                      )}
                      {Number(order.shippingFee) > 0 && (
                        <div className="shipping-row">
                          <span>運費</span>
                          <span>+NT$ {Number(order.shippingFee).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="total-row">
                        <span className="total-label">訂單總金額</span>
                        <span className="total-amt">NT$ {amt.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="divider"/>

                    {/* Payment */}
                    <div className="info-row" style={{marginBottom:0}}>
                      <span className="info-icon">💳</span>
                      <div>
                        <div className="info-label">付款方式</div>
                        <div className="info-val">{pm}</div>
                        <span className="pay-pill" style={{
                          color: order.payStatus==="paid"?"#059669":"#dc2626",
                          borderColor: order.payStatus==="paid"?"#bbf7d0":"#fecaca",
                          background: order.payStatus==="paid"?"#f0fdf4":"#fef2f2",
                        }}>
                          {order.payStatus==="paid" ? "✓ 已付款" : "✗ 尚未付款"}
                        </span>
                      </div>
                    </div>

                    {/* Order note */}
                    {order.note && (
                      <>
                        <div className="divider"/>
                        <div className="info-row" style={{marginBottom:0}}>
                          <span className="info-icon">📝</span>
                          <div>
                            <div className="info-label">訂單備註</div>
                            <div className="info-val" style={{fontSize:13,color:"#6b6152"}}>{order.note}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )
        )}

        {/* Initial hint */}
        {!searched && !loading && (
          <div className="empty">
            <div className="empty-icon">🍱</div>
            <div className="empty-text">輸入電話查詢訂單</div>
            <div className="empty-sub">請在上方輸入您的聯絡電話</div>
          </div>
        )}
      </main>

      <footer className="footer">
        秀枝餐飲事業 · 訂單查詢系統
      </footer>
    </div>
  );
}
