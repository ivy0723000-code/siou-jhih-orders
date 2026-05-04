import { useState, useEffect } from "react";
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
const PAY_METHOD = { cod:"貨到付款", transfer:"線上轉帳", store:"門市結帳" };
const ORDER_STATUS = {
  confirmed:{label:"已確認",color:"#c8a96e"},
  preparing:{label:"備餐中",color:"#93c5fd"},
  ready:    {label:"可取餐",color:"#6ee7b7"},
  delivered:{label:"已完成",color:"#a78bfa"},
  cancelled:{label:"已取消",color:"#f87171"},
};
function today(){const d=new Date();return d.toISOString().split("T")[0];}
function fmtDate(s){
  const d=new Date(s+"T00:00:00");
  return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日　週${"日一二三四五六"[d.getDay()]}`;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{font-family:'Noto Sans TC',sans-serif;background:#0d1120;color:#e8e2d6;min-height:100vh;}
.bg{min-height:100vh;background:#0d1120;position:relative;}
.bg::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(200,169,110,0.08) 0%,transparent 70%);pointer-events:none;}
.hd{position:relative;padding:0 24px;background:linear-gradient(180deg,#111830 0%,#0d1120 100%);border-bottom:1px solid rgba(200,169,110,0.15);}
.hd::after{content:'';position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);width:120px;height:1px;background:linear-gradient(90deg,transparent,#c8a96e,transparent);}
.hd-inner{max-width:620px;margin:0 auto;padding:28px 0 24px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;}
.hd-emblem{width:64px;height:64px;border-radius:50%;border:1px solid rgba(200,169,110,0.5);display:flex;align-items:center;justify-content:center;background:rgba(200,169,110,0.05);position:relative;}
.hd-emblem::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(200,169,110,0.15);}
.hd-brand{font-family:'Noto Serif TC',serif;font-size:10px;color:#8a6f3e;letter-spacing:4px;margin-bottom:2px;}
.hd-name{font-family:'Noto Serif TC',serif;font-size:20px;color:#c8a96e;letter-spacing:3px;font-weight:600;line-height:1.4;}
.hd-sub{font-size:11px;color:#8a8fa8;letter-spacing:3px;margin-top:2px;}
.hd-divline{width:40px;height:1px;background:linear-gradient(90deg,transparent,#c8a96e,transparent);margin:4px auto 0;}
.main{max-width:620px;margin:0 auto;padding:36px 20px 80px;}
.ann-banner{background:linear-gradient(135deg,rgba(200,169,110,0.1),rgba(200,169,110,0.04));border:1px solid rgba(200,169,110,0.3);border-radius:14px;padding:20px 22px;margin-bottom:28px;position:relative;overflow:hidden;cursor:pointer;}
.ann-banner::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#c8a96e,transparent);}
.ann-dot{width:7px;height:7px;border-radius:50%;background:#c8a96e;animation:pulse 2s infinite;flex-shrink:0;margin-top:5px;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}}
.ann-dot-nav{width:5px;height:5px;border-radius:50%;background:rgba(200,169,110,0.3);transition:all 0.2s;cursor:pointer;}
.ann-dot-nav.on{background:#c8a96e;width:14px;border-radius:3px;}
.search-card{background:rgba(30,42,82,0.5);border:1px solid rgba(200,169,110,0.15);border-radius:16px;padding:30px 28px;margin-bottom:28px;position:relative;overflow:hidden;}
.search-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(200,169,110,0.4),transparent);}
.phone-inp{width:100%;background:rgba(13,20,40,0.8);border:1px solid rgba(200,169,110,0.2);border-radius:10px;padding:14px 18px;font-size:15px;font-family:'Noto Sans TC',sans-serif;color:#e8e2d6;transition:all 0.25s;outline:none;letter-spacing:1px;margin-bottom:14px;}
.phone-inp:focus{border-color:#c8a96e;background:rgba(13,20,40,1);box-shadow:0 0 0 3px rgba(200,169,110,0.08);}
.phone-inp::placeholder{color:rgba(138,143,168,0.5);}
.search-btn{width:100%;background:linear-gradient(135deg,#c8a96e,#8a6f3e);color:#0d1428;border:none;border-radius:10px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Serif TC',serif;letter-spacing:2px;transition:all 0.25s;}
.search-btn:hover:not(:disabled){opacity:0.9;box-shadow:0 4px 16px rgba(200,169,110,0.25);}
.search-btn:disabled{opacity:0.4;cursor:default;}
.order-card{background:rgba(26,33,69,0.7);border:1px solid rgba(200,169,110,0.15);border-radius:16px;padding:0;margin-bottom:16px;position:relative;overflow:hidden;}
.order-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(200,169,110,0.4),transparent);}
.card-top{padding:22px 24px 18px;border-bottom:1px solid rgba(200,169,110,0.08);}
.card-body{padding:20px 24px;}
.info-label{font-size:10px;color:#8a6f3e;letter-spacing:2px;margin-bottom:5px;}
.info-val{font-size:14px;color:#d4cfc4;line-height:1.5;margin-bottom:14px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.items-box{background:rgba(13,20,40,0.5);border:1px solid rgba(200,169,110,0.08);border-radius:10px;padding:16px 18px;margin-bottom:14px;}
.item-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:9px 0;border-bottom:1px solid rgba(200,169,110,0.06);}
.item-row:last-child{border-bottom:none;padding-bottom:0;}
.total-section{border-top:1px solid rgba(200,169,110,0.12);padding-top:12px;margin-top:4px;}
.card-footer{padding:14px 24px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid rgba(200,169,110,0.08);}
.status-pill{font-size:11px;font-weight:600;border-radius:20px;padding:4px 14px;border:1px solid;white-space:nowrap;}
.pay-pill{font-size:12px;font-weight:600;border-radius:20px;padding:5px 14px;border:1px solid;}
.empty{text-align:center;padding:60px 20px;}
.empty-circle{width:72px;height:72px;border-radius:50%;border:1px solid rgba(200,169,110,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;}
.footer{text-align:center;padding:28px 20px;border-top:1px solid rgba(200,169,110,0.08);}
.ann-ovl{position:fixed;inset:0;background:rgba(8,12,26,0.92);display:flex;align-items:flex-end;justify-content:center;z-index:200;padding:20px;backdrop-filter:blur(8px);}
.ann-modal{background:#1a2145;border:1px solid rgba(200,169,110,0.3);border-radius:20px 20px 16px 16px;width:100%;max-width:560px;overflow:hidden;position:relative;}
.ann-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#c8a96e,transparent);}
.spin{display:inline-block;width:16px;height:16px;border:2px solid rgba(13,20,40,0.3);border-top-color:#0d1428;border-radius:50%;animation:spin2 0.7s linear infinite;vertical-align:middle;margin-right:6px;}
@keyframes spin2{to{transform:rotate(360deg)}}
`;

export default function OrderLookup() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [annIdx, setAnnIdx] = useState(0);
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [selectedAnn, setSelectedAnn] = useState(null);
  const todayStr = today();

  useEffect(() => {
    onValue(ref(db,"siou-jhih/announcements"), s => {
      const d=s.val();
      const all=d?Object.values(d):[];
      const active=all.filter(a=>a.active&&a.startDate<=todayStr&&a.endDate>=todayStr);
      setAnnouncements(active);
      if (active.length>0){setSelectedAnn(active[0]);setShowAnnModal(true);}
    },{onlyOnce:true});
  },[]);

  useEffect(()=>{
    if(announcements.length<=1)return;
    const t=setInterval(()=>setAnnIdx(i=>(i+1)%announcements.length),4000);
    return()=>clearInterval(t);
  },[announcements.length]);

  function search(){
    if(!phone.trim())return;
    setLoading(true);setSearched(false);
    let active=[],hist=[],loaded=0;
    const check=()=>{
      loaded++;
      if(loaded<2)return;
      const ph=phone.replace(/-/g,"");
      const all=[...active,...hist]
        .filter(o=>o.phone&&o.phone.replace(/-/g,"").includes(ph))
        .sort((a,b)=>b.deliveryDate.localeCompare(a.deliveryDate)||b.deliveryTime.localeCompare(a.deliveryTime));
      setOrders(all);setLoading(false);setSearched(true);
    };
    onValue(ref(db,"siou-jhih/orders"),s=>{const d=s.val();active=d?Object.values(d):[];check();},{onlyOnce:true});
    onValue(ref(db,"siou-jhih/history"),s=>{const d=s.val();hist=d?Object.values(d):[];check();},{onlyOnce:true});
  }

  const curAnn=announcements[annIdx];

  return(
    <div className="bg">
      <style>{CSS}</style>

      {showAnnModal&&selectedAnn&&(
        <div className="ann-ovl" onClick={()=>setShowAnnModal(false)}>
          <div className="ann-modal" onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowAnnModal(false)} style={{position:"absolute",top:14,right:16,background:"rgba(200,169,110,0.1)",border:"1px solid rgba(200,169,110,0.2)",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#c8a96e",fontSize:13}}>✕</button>
            <div style={{padding:"22px 24px 16px",borderBottom:"1px solid rgba(200,169,110,0.1)"}}>
              <div style={{fontSize:10,color:"#8a6f3e",letterSpacing:3,marginBottom:6}}>最新消息 NOTICE</div>
              <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:18,color:"#e2c98a",fontWeight:600,lineHeight:1.4,paddingRight:32}}>{selectedAnn.title}</div>
              <div style={{fontSize:11,color:"#8a8fa8",marginTop:6}}>{selectedAnn.startDate} ～ {selectedAnn.endDate}</div>
            </div>
            <div style={{padding:"20px 24px 24px",maxHeight:"55vh",overflowY:"auto"}}>
              {selectedAnn.imageUrl&&(
                <img src={selectedAnn.imageUrl} alt="" style={{width:"100%",borderRadius:10,marginBottom:14,objectFit:"cover",maxHeight:220,display:"block"}} onError={e=>e.target.style.display="none"}/>
              )}
              {selectedAnn.body&&<div style={{fontSize:14,color:"#d4cfc4",lineHeight:1.9,whiteSpace:"pre-wrap"}}>{selectedAnn.body}</div>}
            </div>
            {announcements.length>1&&(
              <div style={{padding:"0 24px 20px",display:"flex",gap:8,justifyContent:"center"}}>
                {announcements.map((a,i)=>(
                  <div key={a.id} style={{width:i===annIdx?18:6,height:6,borderRadius:3,background:i===annIdx?"#c8a96e":"rgba(200,169,110,0.25)",transition:"all 0.3s",cursor:"pointer"}} onClick={()=>{setSelectedAnn(a);setAnnIdx(i);}}/>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <header className="hd">
        <div className="hd-inner">
          <div className="hd-emblem">
            <span style={{fontFamily:"'Noto Serif TC',serif",fontSize:22,color:"#c8a96e",fontWeight:600}}>秀</span>
          </div>
          <div>
            <div className="hd-brand">SIOU JHIH CATERING</div>
            <div className="hd-name">秀枝日式精緻商務餐盒</div>
            <div className="hd-sub">訂單查詢</div>
            <div className="hd-divline"/>
          </div>
        </div>
      </header>

      <main className="main">
        {announcements.length>0&&curAnn&&(
          <div className="ann-banner" onClick={()=>{setSelectedAnn(curAnn);setShowAnnModal(true);}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div className="ann-dot"/>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"#8a6f3e",letterSpacing:2,marginBottom:4}}>最新消息</div>
                <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:15,color:"#e2c98a",fontWeight:600,marginBottom:5}}>{curAnn.title}</div>
                {curAnn.imageUrl&&<img src={curAnn.imageUrl} alt="" style={{width:"100%",borderRadius:8,marginBottom:6,objectFit:"cover",maxHeight:120}} onError={e=>e.target.style.display="none"}/>}
                {curAnn.body&&<div style={{fontSize:12,color:"#a89880",lineHeight:1.7,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{curAnn.body}</div>}
              </div>
              <div style={{fontSize:12,color:"#8a6f3e",flexShrink:0,marginTop:4}}>查看 →</div>
            </div>
            {announcements.length>1&&(
              <div style={{display:"flex",gap:8,marginTop:10}}>
                {announcements.map((_,i)=>(
                  <div key={i} className={"ann-dot-nav"+(i===annIdx?" on":"")} onClick={e=>{e.stopPropagation();setAnnIdx(i);}}/>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="search-card">
          <div style={{fontSize:10,color:"#8a6f3e",letterSpacing:3,marginBottom:8}}>ORDER INQUIRY</div>
          <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:18,color:"#e8e2d6",fontWeight:500,marginBottom:4,letterSpacing:1}}>訂單查詢</div>
          <div style={{fontSize:12,color:"#8a8fa8",marginBottom:22,lineHeight:1.7}}>請輸入訂購時留下的聯絡電話，即可查看您的訂單資訊。</div>
          <input className="phone-inp" value={phone} onChange={e=>setPhone(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&search()} placeholder="請輸入聯絡電話" type="tel" maxLength={15}/>
          <button className="search-btn" onClick={search} disabled={loading||!phone.trim()}>
            {loading?<><span className="spin"/>查詢中</>:"查　　詢"}
          </button>
        </div>

        {searched&&orders!==null&&(
          orders.length===0?(
            <div className="empty">
              <div className="empty-circle">🔍</div>
              <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:16,color:"#8a8fa8",letterSpacing:2,marginBottom:6}}>查無訂單記錄</div>
              <div style={{fontSize:12,color:"rgba(138,143,168,0.6)"}}>請確認電話號碼是否正確，或聯繫店家確認</div>
            </div>
          ):<>
            <div style={{fontSize:11,color:"#8a6f3e",letterSpacing:2,marginBottom:16,textAlign:"center"}}>共找到 {orders.length} 筆訂單記錄</div>
            {orders.map(order=>{
              const items=(order.cart||[]).filter(c=>c.qty>0);
              const baseAmt=(order.cart||[]).reduce((s,c)=>{const m=MENU.find(m=>m.id===c.menuId);return s+(m?m.price*c.qty:0);},0)+(order.customItems||[]).reduce((s,c)=>s+(Number(c.price)||0)*(Number(c.qty)||1),0);
              const discAmt=order.discount?Math.round(baseAmt*(1-Number(order.discount)/100)):baseAmt;
              const amt=discAmt+Number(order.shippingFee||0);
              const st=ORDER_STATUS[order.status]||ORDER_STATUS.confirmed;
              const pm=PAY_METHOD[order.payMethod]||"貨到付款";
              return(
                <div key={order.id} className="order-card">
                  <div className="card-top">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                      <div>
                        <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:19,color:"#e8e2d6",fontWeight:600,letterSpacing:1}}>{order.customerName}</div>
                        <div style={{fontSize:12,color:"#8a8fa8",marginTop:3,letterSpacing:1}}>{order.phone}</div>
                      </div>
                      <span className="status-pill" style={{color:st.color,borderColor:st.color+"44",background:st.color+"10"}}>{st.label}</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="info-grid" style={{marginBottom:14}}>
                      <div>
                        <div className="info-label">取餐日期</div>
                        <div style={{fontSize:13,color:"#d4cfc4"}}>{fmtDate(order.deliveryDate)}</div>
                      </div>
                      <div>
                        <div className="info-label">取餐時間</div>
                        <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:22,color:"#c8a96e"}}>{order.deliveryTime}</div>
                      </div>
                    </div>
                    <div className="info-label">取餐方式</div>
                    <div className="info-val">
                      {order.type==="delivery"?"🛵 外送":"🏪 自取"}
                      {order.posNo&&<span style={{fontSize:12,color:"#8a6f3e",marginLeft:10}}>自取單號 #{order.posNo}</span>}
                    </div>
                    {order.type==="delivery"&&order.address&&<>
                      <div className="info-label">配送地址</div>
                      <div className="info-val">📍 {order.address}</div>
                    </>}
                    {order.taxId&&<>
                      <div className="info-label">統一編號</div>
                      <div className="info-val">🧾 {order.taxId}</div>
                    </>}
                    <div className="items-box">
                      <div style={{fontSize:10,color:"#8a6f3e",letterSpacing:2,marginBottom:12}}>餐點明細 MENU ITEMS</div>
                      {items.map(c=>{const m=MENU.find(m=>m.id===c.menuId);if(!m)return null;return(
                        <div key={c.menuId} className="item-row">
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:"#d4cfc4",lineHeight:1.5}}>{m.name}</div>
                            {c.note&&<div style={{fontSize:11,color:"#8a6f3e",marginTop:2}}>備註：{c.note}</div>}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:11,color:"#8a8fa8"}}>× {c.qty}</div>
                            <div style={{fontSize:13,color:"#c8a96e",fontWeight:500,marginTop:1}}>NT$ {(m.price*c.qty).toLocaleString()}</div>
                          </div>
                        </div>
                      );})}
                      {(order.customItems||[]).filter(c=>c.name||c.price).map((c,i)=>(
                        <div key={"ci"+i} className="item-row">
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:"#c8a96e",lineHeight:1.5}}>✦ {c.name||"客製餐盒"}</div>
                            {c.note&&<div style={{fontSize:11,color:"#8a6f3e",marginTop:2}}>備註：{c.note}</div>}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:11,color:"#8a8fa8"}}>× {c.qty||1}</div>
                            <div style={{fontSize:13,color:"#c8a96e",fontWeight:500,marginTop:1}}>NT$ {(Number(c.price||0)*Number(c.qty||1)).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                      <div className="total-section">
                        {order.discount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#6ee7b7",marginBottom:5}}><span>折扣 {order.discount}% OFF</span><span>- NT$ {(baseAmt-discAmt).toLocaleString()}</span></div>}
                        {Number(order.shippingFee)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#93c5fd",marginBottom:5}}><span>運費</span><span>+ NT$ {Number(order.shippingFee).toLocaleString()}</span></div>}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                          <span style={{fontSize:11,color:"#8a6f3e",letterSpacing:2}}>訂單總金額</span>
                          <span style={{fontFamily:"'Noto Serif TC',serif",fontSize:24,color:"#e2c98a",fontWeight:600}}>NT$ {amt.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {order.note&&<><div className="info-label">訂單備註</div><div style={{fontSize:13,color:"#8a8fa8",marginBottom:0}}>{order.note}</div></>}
                  </div>
                  <div className="card-footer">
                    <span style={{fontSize:12,color:"#8a8fa8"}}>💳 {pm}</span>
                    <span className="pay-pill" style={{color:order.payStatus==="paid"?"#6ee7b7":"#f87171",borderColor:order.payStatus==="paid"?"rgba(110,231,183,0.3)":"rgba(248,113,113,0.3)",background:order.payStatus==="paid"?"rgba(110,231,183,0.06)":"rgba(248,113,113,0.06)"}}>
                      {order.payStatus==="paid"?"✓ 已付款":"✗ 尚未付款"}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {!searched&&!loading&&(
          <div className="empty">
            <div className="empty-circle">🍱</div>
            <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:16,color:"#8a8fa8",letterSpacing:2,marginBottom:6}}>查詢您的訂單</div>
            <div style={{fontSize:12,color:"rgba(138,143,168,0.6)"}}>輸入您的聯絡電話即可查看訂單狀態</div>
          </div>
        )}
      </main>
      <footer className="footer">
        <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:13,color:"#8a6f3e",letterSpacing:3,marginBottom:4}}>秀枝餐飲事業</div>
        <div style={{fontSize:10,color:"rgba(138,143,168,0.5)",letterSpacing:2}}>SIOU JHIH CATERING · 秀枝日式精緻商務餐盒</div>
      </footer>
    </div>
  );
}
