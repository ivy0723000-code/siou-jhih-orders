import { useState, useRef, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { ref, onValue, set } from "firebase/database";

const B = {
  navy:"#1a2145", dark:"#111830", deep:"#0d1428", mid:"#1e2a52",
  gold:"#c8a96e", goldL:"#e2c98a", goldD:"#8a6f3e",
  white:"#f5f0e8", offW:"#d4cfc4", text:"#e8e2d6", muted:"#8a8fa8",
};

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

const ORDER_STATUS = {
  confirmed:{label:"已確認",color:"#c8a96e",bg:"rgba(200,169,110,0.12)",bd:"rgba(200,169,110,0.3)"},
  preparing:{label:"備　餐",color:"#93c5fd",bg:"rgba(147,197,253,0.1)", bd:"rgba(147,197,253,0.3)"},
  ready:    {label:"可取餐",color:"#6ee7b7",bg:"rgba(110,231,183,0.1)", bd:"rgba(110,231,183,0.3)"},
  delivered:{label:"已完成",color:"#a78bfa",bg:"rgba(167,139,250,0.1)", bd:"rgba(167,139,250,0.3)"},
  cancelled:{label:"已取消",color:"#f87171",bg:"rgba(248,113,113,0.08)",bd:"rgba(248,113,113,0.25)"},
};
const PAY_METHOD = {
  cod:     {label:"貨到付款",icon:"🚪"},
  transfer:{label:"線上轉帳",icon:"📱"},
  store:   {label:"門市結帳",icon:"🏪"},
};
const PAY_STATUS = {
  unpaid:{label:"未結帳",color:"#f87171",bg:"rgba(248,113,113,0.1)",bd:"rgba(248,113,113,0.35)"},
  paid:  {label:"已匯款",color:"#6ee7b7",bg:"rgba(110,231,183,0.1)",bd:"rgba(110,231,183,0.35)"},
};

const ADDR_DATA = {
  "台南市北區":["育德二路","育德路","成功路","長榮路","海安路","公園路","西門路","中正路","民族路","勝利路","和緯路"],
  "台南市安平區":["永華路二段","永華路一段","安平路","建平路","育平路","文平路","效平路","慶平路","國平路","中華西路二段"],
  "台南市中西區":["民生路","忠義路","西門路","府前路","永福路","開山路","樹林街","友愛街","南門路","金華路"],
  "台南市東區":["東門路","崇德路","長榮路","裕農路","林森路","東平路","大同路","勝利路"],
  "台南市南區":["南門路","健康路","文南路","金華路四段","新孝路","喜樹路","保安路","明和路"],
  "台南市永康區":["中正路","永安路","中華路","復興路","文化路","仁愛路","光明路","鹽行路","大灣路"],
  "台南市仁德區":["仁義路","文賢路","保華路","仁德路","太子路","義農路","大同路"],
  "台南市歸仁區":["歸仁大道","文化街","崇善路","民族路","中正北路","仁義路"],
  "台北市信義區":["信義路","基隆路","忠孝東路","松仁路","光復南路"],
  "台北市大安區":["忠孝東路","仁愛路","信義路","敦化南路","復興南路"],
};
function getAddrSugg(val) {
  if (!val||val.length<2) return [];
  const res=[];
  for (const [area,streets] of Object.entries(ADDR_DATA)) {
    for (const st of streets) {
      if ((area+st).includes(val)||st.includes(val)||area.includes(val)) {
        res.push({full:area+st,area,st});
        if (res.length>=7) return res;
      }
    }
  }
  return res;
}

function today(n=0){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];}
function fmtDate(s){const d=new Date(s+"T00:00:00");return `${d.getMonth()+1}/${d.getDate()} 週${"日一二三四五六"[d.getDay()]}`;}
function fmtDateFull(s){const d=new Date(s+"T00:00:00");return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;}
function dayLabel(s){if(s===today())return"今天";if(s===today(1))return"明天";if(s===today(2))return"後天";return null;}
function cartAmt(cart,customItems){
  const mAmt=(cart||[]).reduce((s,c)=>{const m=MENU.find(m=>m.id===c.menuId);return s+(m?m.price*c.qty:0);},0);
  const cAmt=(customItems||[]).reduce((s,c)=>s+(Number(c.price)||0)*(Number(c.qty)||1),0);
  return mAmt+cAmt;
}
function emptyCart(){return MENU.map(m=>({menuId:m.id,qty:0,note:""}));}
function newForm(date){
  return{id:"",customerName:"",phone:"",posNo:"",cart:emptyCart(),
    deliveryDate:date||today(1),deliveryTime:"12:00",
    type:"delivery",address:"",taxId:"",note:"",
    status:"confirmed",payMethod:"cod",payStatus:"unpaid",customItems:[],
    isKeyed:false,isDelivered:false,driverMatched:false,isSent:false};
}
function genId(){return"ORD-"+String(Date.now()).slice(-6);}

// Storage keys
const DB_ORDERS    = "siou-jhih/orders";
const DB_HISTORY   = "siou-jhih/history";
const DB_CUSTOMERS = "siou-jhih/customers";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&family=Noto+Sans+TC:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans TC',sans-serif;background:#0d1428;color:#e8e2d6;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:#0d1428;}
::-webkit-scrollbar-thumb{background:#8a6f3e;border-radius:3px;}
.gline{height:1px;background:linear-gradient(90deg,transparent,#c8a96e,transparent);}
.deco{position:absolute;width:80px;height:80px;pointer-events:none;}
.deco::before,.deco::after{content:'';position:absolute;background:#c8a96e;opacity:0.45;}
.deco.tl{top:0;left:0;}.deco.tl::before{top:0;left:0;width:36px;height:1px;}.deco.tl::after{top:0;left:0;width:1px;height:36px;}
.deco.tr{top:0;right:0;}.deco.tr::before{top:0;right:0;width:36px;height:1px;}.deco.tr::after{top:0;right:0;width:1px;height:36px;}
.dtab{background:transparent;color:#8a8fa8;border:1px solid rgba(200,169,110,0.15);border-radius:6px;padding:6px 12px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;font-size:12px;transition:all 0.2s;white-space:nowrap;text-align:center;min-width:62px;}
.dtab:hover{border-color:#8a6f3e;color:#c8a96e;}
.dtab.on{background:#c8a96e;color:#0d1428;font-weight:600;}
.dtab.has{color:#e2c98a;border-color:rgba(200,169,110,0.35);}
.card{background:#1e2a52;border:1px solid rgba(200,169,110,0.15);border-radius:12px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start;transition:border-color 0.2s,box-shadow 0.2s;position:relative;overflow:hidden;}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(200,169,110,0.25),transparent);}
.card:hover{border-color:rgba(200,169,110,0.38);box-shadow:0 4px 18px rgba(0,0,0,0.3);}
.scard{background:#1e2a52;border:1px solid rgba(200,169,110,0.15);border-radius:10px;padding:9px 14px;display:flex;align-items:center;gap:9px;}
.bgold{background:linear-gradient(135deg,#c8a96e,#8a6f3e);color:#0d1428;border:none;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Noto Sans TC',sans-serif;letter-spacing:1px;transition:opacity 0.2s;}
.bgold:hover{opacity:0.84;}
.bgh{background:transparent;color:#8a8fa8;border:1px solid rgba(200,169,110,0.2);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:all 0.2s;}
.bgh:hover{border-color:#8a6f3e;color:#c8a96e;}
.bgh.del:hover{border-color:#7f1d1d;color:#fca5a5;}
.fpill{background:transparent;color:#8a8fa8;border:1px solid rgba(200,169,110,0.2);border-radius:20px;padding:4px 13px;font-size:12px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:all 0.2s;}
.fpill.on{background:rgba(200,169,110,0.14);color:#c8a96e;border-color:#8a6f3e;}
.inp{width:100%;background:#0d1428;border:1px solid rgba(200,169,110,0.2);border-radius:7px;padding:8px 12px;color:#e8e2d6;font-size:13px;font-family:'Noto Sans TC',sans-serif;transition:border-color 0.2s;}
.inp:focus{outline:none;border-color:#8a6f3e;}
.inp::placeholder{color:#8a8fa8;}
.ssel{border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;border:1px solid;}
.bdg{font-size:11px;border-radius:4px;padding:2px 6px;border:1px solid;font-family:'Noto Sans TC',sans-serif;}
.ovl{position:fixed;inset:0;background:rgba(8,12,26,0.9);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;backdrop-filter:blur(5px);}
.modal{background:#1a2145;border:1px solid rgba(200,169,110,0.25);border-radius:16px;padding:26px;width:100%;max-width:600px;max-height:93vh;overflow-y:auto;position:relative;}
.modal.wide{max-width:740px;}
.modal::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#c8a96e,transparent);}
.flbl{font-size:11px;color:#8a6f3e;letter-spacing:1px;display:block;margin-bottom:5px;}
.mrow{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(200,169,110,0.1);background:rgba(0,0,0,0.18);margin-bottom:5px;transition:all 0.18s;}
.mrow.on{border-color:rgba(200,169,110,0.32);background:rgba(200,169,110,0.055);}
.qbtn{background:rgba(200,169,110,0.14);color:#c8a96e;border:1px solid rgba(200,169,110,0.28);border-radius:5px;width:26px;height:26px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.14s;}
.qbtn:hover:not(:disabled){background:rgba(200,169,110,0.28);}
.qbtn:disabled{opacity:0.18;cursor:default;}
.qn{font-size:14px;font-weight:700;color:#e2c98a;min-width:20px;text-align:center;font-family:'Noto Serif TC',serif;}
.inote{font-size:11px;background:#0d1428;border:1px solid rgba(200,169,110,0.14);border-radius:5px;padding:3px 7px;color:#8a8fa8;font-family:'Noto Sans TC',sans-serif;width:86px;}
.inote:focus{outline:none;border-color:#8a6f3e;color:#e8e2d6;}
.inote::placeholder{color:rgba(138,143,168,0.38);}
.csum{background:rgba(200,169,110,0.065);border:1px solid rgba(200,169,110,0.2);border-radius:9px;padding:11px 13px;}
.pbtn{flex:1;background:transparent;color:#8a8fa8;border:1px solid rgba(200,169,110,0.2);border-radius:7px;padding:8px 4px;font-size:12px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:all 0.2s;text-align:center;}
.pbtn.on{background:rgba(200,169,110,0.13);color:#c8a96e;border-color:#8a6f3e;}
.adrop{position:absolute;top:calc(100% + 3px);left:0;right:0;background:#18224a;border:1px solid rgba(200,169,110,0.28);border-radius:8px;z-index:300;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,0.55);}
.aopt{padding:8px 12px;font-size:12px;color:#d4cfc4;cursor:pointer;transition:background 0.13s;display:flex;align-items:center;gap:8px;}
.aopt:hover{background:rgba(200,169,110,0.09);color:#e2c98a;}
.atag{font-size:10px;color:#8a6f3e;background:rgba(200,169,110,0.09);border-radius:3px;padding:1px 5px;flex-shrink:0;}
.pspill{font-size:11px;border-radius:5px;padding:3px 9px;border:1px solid;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:all 0.18s;background:transparent;white-space:nowrap;}
/* Tab nav */
.nav-tab{background:transparent;color:#8a8fa8;border:none;border-bottom:2px solid transparent;padding:10px 18px;font-size:13px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:all 0.2s;white-space:nowrap;}
.nav-tab.on{color:#c8a96e;border-bottom-color:#c8a96e;font-weight:600;}
/* Customer card */
.cust-card{background:#1e2a52;border:1px solid rgba(200,169,110,0.15);border-radius:10px;padding:14px 16px;cursor:pointer;transition:all 0.2s;}
.cust-card:hover{border-color:rgba(200,169,110,0.4);background:#243260;}
/* Phone suggestion */
.phone-drop{position:absolute;top:calc(100% + 3px);left:0;right:0;background:#18224a;border:1px solid rgba(200,169,110,0.28);border-radius:8px;z-index:300;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,0.55);}
.phone-opt{padding:10px 14px;cursor:pointer;transition:background 0.13s;border-bottom:1px solid rgba(200,169,110,0.08);}
.phone-opt:last-child{border-bottom:none;}
.phone-opt:hover{background:rgba(200,169,110,0.08);}
/* History search */
.hist-row{background:#1a2248;border:1px solid rgba(200,169,110,0.1);border-radius:8px;padding:12px 14px;margin-bottom:7px;transition:border-color 0.2s;}
.hist-row:hover{border-color:rgba(200,169,110,0.3);}
`;

export default function App() {
  // ── Core state ─────────────────────────────────────────────────────────────
  const [orders,   setOrders]   = useState([]);
  const [history,  setHistory]  = useState([]); // all completed/archived orders
  const [customers,setCustomers]= useState({}); // keyed by phone
  const [selDate,  setSelDate]  = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [filter,   setFilter]   = useState("all");
  const [form,     setForm]     = useState(newForm(today(1)));
  const [mainTab,  setMainTab]  = useState("orders"); // orders | history | customers
  const [syncState,setSyncState]= useState("idle");
  const [lastSync, setLastSync] = useState(null);

  // Address autocomplete
  const [addrVal,   setAddrVal]  = useState("");
  const [addrSuggs, setAddrSuggs]= useState([]);
  const [showAddr,  setShowAddr] = useState(false);
  const addrRef = useRef(null);

  // Phone autocomplete
  const [phoneSuggs, setPhoneSuggs] = useState([]);
  const [showPhone,  setShowPhone]  = useState(false);
  const phoneRef = useRef(null);

  // History search
  const [histSearch, setHistSearch] = useState("");

  // Customer detail modal
  const [custDetail, setCustDetail] = useState(null);

  const saveTimer = useRef(null);

  // ── Load from Firebase (realtime) ───────────────────────────────────────────
  useEffect(() => {
    const unsub1 = onValue(ref(db, DB_ORDERS),    s => { const d=s.val(); setOrders(d?Object.values(d):[]); });
    const unsub2 = onValue(ref(db, DB_HISTORY),   s => { const d=s.val(); setHistory(d?Object.values(d):[]); });
    const unsub3 = onValue(ref(db, DB_CUSTOMERS), s => { const d=s.val(); setCustomers(d||{}); });
    setSyncState("synced");
    setLastSync(new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // ── Save all data to Firebase ───────────────────────────────────────────────
  const saveAll = useCallback(async (newOrders, newHistory, newCustomers) => {
    setSyncState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const toObj = arr => { const o={}; arr.forEach(i=>{ if(i?.id) o[i.id]=i; }); return o; };
        await Promise.all([
          set(ref(db, DB_ORDERS),    toObj(newOrders)),
          set(ref(db, DB_HISTORY),   toObj(newHistory)),
          set(ref(db, DB_CUSTOMERS), newCustomers),
        ]);
        setSyncState("saved");
        setLastSync(new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}));
        setTimeout(()=>setSyncState("idle"),2500);
      } catch(e){ setSyncState("error"); setTimeout(()=>setSyncState("idle"),3000); }
    }, 500);
  }, []);

  // ── Update customer database from an order ─────────────────────────────────
  function buildCustomerRecord(order, existing) {
    const prev = existing || { phone:order.phone, name:order.customerName, address:order.address, taxId:order.taxId, orderCount:0, totalSpend:0, lastOrder:"", topItems:{} };
    const amt = cartAmt(order.cart, order.customItems);
    // tally menu items
    const topItems = {...(prev.topItems||{})};
    (order.cart||[]).filter(c=>c.qty>0).forEach(c=>{
      topItems[c.menuId] = (topItems[c.menuId]||0) + c.qty;
    });
    return {
      ...prev,
      name: order.customerName,
      address: order.address || prev.address,
      taxId: order.taxId || prev.taxId,
      orderCount: (prev.orderCount||0) + 1,
      totalSpend: (prev.totalSpend||0) + amt,
      lastOrder: order.deliveryDate,
      topItems,
    };
  }

  function commitOrders(newOrders, newHistory, newCustomers) {
    setOrders(newOrders);
    setHistory(newHistory);
    setCustomers(newCustomers);
    saveAll(newOrders, newHistory, newCustomers);
  }

  // ── Save order (new / edit) ─────────────────────────────────────────────────
  function save() {
    if (!form.customerName||!form.phone){ alert("請填寫客戶姓名與電話"); return; }
    if (cartAmt(form.cart,form.customItems)===0){ alert("請至少選擇一項餐點或新增客製餐盒"); return; }

    const newOrder = editId ? {...form} : {...form, id:genId()};
    const newOrders = editId
      ? orders.map(o=>o.id===editId ? newOrder : o)
      : [...orders, newOrder];

    // Update customer DB
    const newCustomers = {...customers};
    newCustomers[form.phone] = buildCustomerRecord(newOrder, customers[form.phone]);

    commitOrders(newOrders, history, newCustomers);
    setShowForm(false);
  }

  // ── Archive completed orders to history (manual trigger) ───────────────────
  function archiveOrder(id) {
    const order = orders.find(o=>o.id===id);
    if (!order) return;
    const newHistory = [order, ...history];
    const newOrders  = orders.filter(o=>o.id!==id);
    commitOrders(newOrders, newHistory, customers);
  }

  // ── Auto-archive delivered orders older than today ─────────────────────────
  useEffect(() => {
    const stale = orders.filter(o=>o.status==="delivered" && o.deliveryDate < today());
    if (stale.length===0) return;
    const newHistory = [...stale, ...history];
    const newOrders  = orders.filter(o=>!(o.status==="delivered" && o.deliveryDate < today()));
    commitOrders(newOrders, newHistory, customers);
  // eslint-disable-next-line
  }, []);

  function del(id){ if(window.confirm("確定刪除此訂單？")) commitOrders(orders.filter(o=>o.id!==id), history, customers); }
  function setOStatus(id,s){
    const newOrders = orders.map(o=>o.id===id?{...o,status:s}:o);
    commitOrders(newOrders, history, customers);
  }
  function togglePay(id){
    const newOrders = orders.map(o=>o.id===id?{...o,payStatus:o.payStatus==="paid"?"unpaid":"paid"}:o);
    commitOrders(newOrders, history, customers);
  }
  function toggleKeyed(id){
    const newOrders = orders.map(o=>o.id===id?{...o,isKeyed:!o.isKeyed}:o);
    commitOrders(newOrders, history, customers);
  }
  function toggleDelivered(id){
    const newOrders = orders.map(o=>o.id===id?{...o,isDelivered:!o.isDelivered}:o);
    commitOrders(newOrders, history, customers);
  }
  function toggleDriver(id){
    const newOrders = orders.map(o=>o.id===id?{...o,driverMatched:!o.driverMatched}:o);
    commitOrders(newOrders, history, customers);
  }
  function toggleSent(id){
    const newOrders = orders.map(o=>o.id===id?{...o,isSent:!o.isSent}:o);
    commitOrders(newOrders, history, customers);
  }

  // ── Form helpers ───────────────────────────────────────────────────────────
  function openNew(){ setForm(newForm(selDate)); setAddrVal(""); setEditId(null); setShowForm(true); }
  function openEdit(o){ setForm({...o,cart:o.cart?.length?o.cart:emptyCart()}); setAddrVal(o.address||""); setEditId(o.id); setShowForm(true); }

  // Fill form from customer record
  function fillFromCustomer(cust) {
    setForm(f=>({...f, customerName:cust.name, phone:cust.phone, address:cust.address||f.address, taxId:cust.taxId||f.taxId}));
    setAddrVal(cust.address||"");
    setShowPhone(false);
  }

  function handlePhone(v) {
    setForm(f=>({...f,phone:v}));
    if (v.length>=4) {
      const matches = Object.values(customers).filter(c=>c.phone.includes(v)||c.name.includes(v));
      setPhoneSuggs(matches.slice(0,5));
      setShowPhone(matches.length>0);
    } else {
      setShowPhone(false);
    }
  }
  function handleAddr(v) {
    setAddrVal(v); setForm(f=>({...f,address:v}));
    const s=getAddrSugg(v); setAddrSuggs(s); setShowAddr(s.length>0);
  }
  function pickAddr(s){ setAddrVal(s.full); setForm(f=>({...f,address:s.full})); setShowAddr(false); }
  function setQty(menuId,d){ setForm(f=>({...f,cart:f.cart.map(c=>c.menuId===menuId?{...c,qty:Math.max(0,c.qty+d)}:c)})); }
  function setINote(menuId,v){ setForm(f=>({...f,cart:f.cart.map(c=>c.menuId===menuId?{...c,note:v}:c)})); }

  // ── 修改：handleTypeChange 不清掉 posNo ────────────────────────────────────
  function handleTypeChange(v){
    setForm(f=>({...f, type:v}));
  }

  // Close dropdowns on outside click
  useEffect(()=>{
    const h=e=>{
      if(addrRef.current&&!addrRef.current.contains(e.target)) setShowAddr(false);
      if(phoneRef.current&&!phoneRef.current.contains(e.target)) setShowPhone(false);
    };
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const dateTabs = Array.from({length:60},(_,i)=>today(i));
  const countByDate = d=>orders.filter(o=>o.deliveryDate===d).length;
  const pickupCount = d=>orders.filter(o=>o.deliveryDate===d&&o.type==="pickup").length;
  const filtered = orders
    .filter(o=>o.deliveryDate===selDate&&(filter==="all"||o.type===filter))
    .sort((a,b)=>a.deliveryTime.localeCompare(b.deliveryTime));
  const stats={
    total:filtered.length,
    delivery:filtered.filter(o=>o.type==="delivery").length,
    pickup:filtered.filter(o=>o.type==="pickup").length,
    tax:filtered.filter(o=>o.taxId).length,
    amount:filtered.reduce((s,o)=>s+cartAmt(o.cart,o.customItems),0),
    unpaid:filtered.filter(o=>o.payStatus==="unpaid").length,
  };
  const activeItems=form.cart.filter(c=>c.qty>0);
  const formTotal=cartAmt(form.cart,form.customItems);

  const syncColors={idle:"#374151",saving:"#fbbf24",saved:"#6ee7b7",synced:"#6ee7b7",error:"#f87171"};
  const syncLabels={idle:lastSync?`同步 ${lastSync}`:"",saving:"儲存中…",saved:"✓ 已儲存",synced:"✓ 已同步",error:"⚠ 失敗"};

  // History filtered
  const histFiltered = history.filter(o=>{
    if (!histSearch) return true;
    return o.customerName.includes(histSearch)||o.phone.includes(histSearch)||o.id.includes(histSearch);
  }).slice(0,50);

  // Customer list sorted by last order
  const custList = Object.values(customers).sort((a,b)=>b.lastOrder?.localeCompare(a.lastOrder||"")||0);

  // ── Render order card ──────────────────────────────────────────────────────
  function OrderCard({order, showArchive=true}) {
    const st=ORDER_STATUS[order.status]||ORDER_STATUS.confirmed;
    const pm=PAY_METHOD[order.payMethod]||PAY_METHOD.cod;
    const ps=PAY_STATUS[order.payStatus]||PAY_STATUS.unpaid;
    const items=(order.cart||[]).filter(c=>c.qty>0);
    const amt=cartAmt(order.cart,order.customItems);
    return(
      <div className="card">
        <div style={{textAlign:"center",minWidth:60,background:"rgba(0,0,0,0.22)",borderRadius:8,padding:"9px 5px",border:`1px solid rgba(200,169,110,0.13)`,flexShrink:0}}>
          <div style={{fontSize:9,color:B.muted,letterSpacing:1,marginBottom:2}}>{order.type==="delivery"?"外送":"自取"}</div>
          <div style={{fontSize:11,color:B.goldL,fontWeight:600,marginBottom:2,letterSpacing:0.5}}>
            {(()=>{const d=new Date(order.deliveryDate+"T00:00:00");return `${d.getMonth()+1}/${d.getDate()} 週${"日一二三四五六"[d.getDay()]}`;})()}
          </div>
          <div style={{fontSize:15,fontWeight:700,color:B.gold,fontFamily:"'Noto Serif TC',serif",lineHeight:1.1}}>{order.deliveryTime}</div>
          {order.posNo&&(
            <div style={{marginTop:5,background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:4,padding:"2px 4px"}}>
              <div style={{fontSize:9,color:"#d97706"}}>🖨️ POS</div>
              <div style={{fontSize:14,fontWeight:700,color:"#fbbf24",fontFamily:"'Noto Serif TC',serif",lineHeight:1}}>#{order.posNo}</div>
              <button className="pspill" onClick={()=>toggleSent(order.id)}
                style={{marginTop:4,fontSize:10,width:"100%",textAlign:"center",color:order.isSent?"#6ee7b7":"#f87171",background:order.isSent?"rgba(110,231,183,0.1)":"rgba(248,113,113,0.08)",borderColor:order.isSent?"rgba(110,231,183,0.35)":"rgba(248,113,113,0.3)"}}>
                {order.isSent?"✓ 已送單":"✗ 未送單"}
              </button>
            </div>
          )}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:15,fontWeight:600,color:B.white,fontFamily:"'Noto Serif TC',serif"}}>{order.customerName}</span>
            <span style={{fontSize:12,color:B.muted}}>{order.phone}</span>
            {order.taxId&&<span className="bdg" style={{color:"#c4b5fd",background:"rgba(167,139,250,0.08)",borderColor:"rgba(167,139,250,0.22)"}}>🧾 {order.taxId}</span>}
            <span className="bdg" style={{color:order.type==="delivery"?"#93c5fd":"#6ee7b7",background:order.type==="delivery"?"rgba(147,197,253,0.07)":"rgba(110,231,183,0.07)",borderColor:order.type==="delivery"?"rgba(147,197,253,0.18)":"rgba(110,231,183,0.18)"}}>
              {order.type==="delivery"?"🛵 外送":"🏪 自取"}
            </span>
            <span className="bdg" style={{color:"#fcd34d",background:"rgba(252,211,77,0.07)",borderColor:"rgba(252,211,77,0.18)"}}>{pm.icon} {pm.label}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:4}}>
            {items.map(c=>{const m=MENU.find(m=>m.id===c.menuId);if(!m)return null;return(
              <div key={c.menuId} style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:B.offW}}>{m.name}</span>
                <span style={{fontSize:12,color:B.gold,fontWeight:600}}>×{c.qty}</span>
                <span style={{fontSize:11,color:B.muted}}>${(m.price*c.qty).toLocaleString()}</span>
                {c.note&&<span className="bdg" style={{color:"#d4a853",background:"rgba(200,169,110,0.07)",borderColor:"rgba(200,169,110,0.14)"}}>備：{c.note}</span>}
              </div>
            );})}
            {(order.customItems||[]).filter(c=>c.name||c.price).map((c,i)=>(
              <div key={"ci"+i} style={{display:"flex",flexDirection:"column",gap:2,marginBottom:3,background:"rgba(252,211,77,0.05)",border:"1px solid rgba(252,211,77,0.15)",borderRadius:6,padding:"4px 8px"}}>
                <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:"#fcd34d",fontWeight:600}}>✦ {c.name||"客製餐盒"}</span>
                  <span style={{fontSize:11,color:B.gold}}>×{c.qty||1}</span>
                  <span style={{fontSize:11,color:B.muted}}>${(Number(c.price||0)*Number(c.qty||1)).toLocaleString()}</span>
                </div>
                {c.note&&<div style={{fontSize:11,color:"#d4a853",lineHeight:1.5,wordBreak:"break-all"}}>備註：{c.note}</div>}
              </div>
            ))}
          </div>
          {order.type==="delivery"&&order.address&&<div style={{fontSize:11,color:B.muted,marginBottom:3}}>📍 {order.address}</div>}
          {order.note&&<div className="bdg" style={{color:"#d4a853",background:"rgba(200,169,110,0.06)",borderColor:"rgba(200,169,110,0.14)",fontSize:11,marginTop:2}}>備　{order.note}</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0,minWidth:92}}>
          <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:15,fontWeight:700,color:B.goldL}}>${amt.toLocaleString()}</div>
          <button className="pspill" onClick={()=>togglePay(order.id)} style={{color:ps.color,background:ps.bg,borderColor:ps.bd}}>
            {order.payStatus==="paid"?"✓ 已匯款":"✗ 未結帳"}
          </button>
          <button className="pspill" onClick={()=>toggleKeyed(order.id)}
            style={{color:order.isKeyed?"#6ee7b7":"#f87171",background:order.isKeyed?"rgba(110,231,183,0.1)":"rgba(248,113,113,0.08)",borderColor:order.isKeyed?"rgba(110,231,183,0.35)":"rgba(248,113,113,0.3)"}}>
            {order.isKeyed?"✓ 已Key單":"✗ 未Key單"}
          </button>
          {order.type==="delivery"&&<>
            <button className="pspill" onClick={()=>toggleDelivered(order.id)}
              style={{color:order.isDelivered?"#6ee7b7":"#f87171",background:order.isDelivered?"rgba(110,231,183,0.1)":"rgba(248,113,113,0.08)",borderColor:order.isDelivered?"rgba(110,231,183,0.35)":"rgba(248,113,113,0.3)"}}>
              {order.isDelivered?"✓ 已送達":"✗ 未送達"}
            </button>
            <button className="pspill" onClick={()=>toggleDriver(order.id)}
              style={{color:order.driverMatched?"#fbbf24":"#9ca3af",background:order.driverMatched?"rgba(251,191,36,0.1)":"rgba(156,163,175,0.08)",borderColor:order.driverMatched?"rgba(251,191,36,0.35)":"rgba(156,163,175,0.3)"}}>
              {order.driverMatched?"🛵 司機已媒合":"🔍 待媒合司機"}
            </button>
          </>}
          <select value={order.status} onChange={e=>setOStatus(order.id,e.target.value)} className="ssel" style={{background:st.bg,color:st.color,borderColor:st.bd}}>
            {Object.entries(ORDER_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <button className="bgh" onClick={()=>openEdit(order)}>編輯</button>
            {showArchive&&<button className="bgh" style={{color:"#a78bfa",borderColor:"rgba(167,139,250,0.25)"}} onClick={()=>archiveOrder(order.id)}>歸檔</button>}
            <button className="bgh del" onClick={()=>del(order.id)}>刪除</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:B.deep}}>
      <style>{CSS}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{background:`linear-gradient(180deg,${B.dark},${B.navy})`,borderBottom:`1px solid rgba(200,169,110,0.2)`,padding:"0 22px",position:"relative",overflow:"hidden"}}>
        <svg style={{position:"absolute",top:"-28px",right:"-28px",opacity:0.055}} width="150" height="150"><circle cx="75" cy="75" r="65" fill="none" stroke="#c8a96e" strokeWidth="1.5"/><circle cx="75" cy="75" r="46" fill="none" stroke="#c8a96e" strokeWidth="0.8"/></svg>
        <svg style={{position:"absolute",top:"-28px",left:"-28px",opacity:0.055}} width="150" height="150"><circle cx="75" cy="75" r="65" fill="none" stroke="#c8a96e" strokeWidth="1.5"/><circle cx="75" cy="75" r="46" fill="none" stroke="#c8a96e" strokeWidth="0.8"/></svg>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 0",position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:"50%",border:`1.5px solid ${B.gold}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontFamily:"'Noto Serif TC',serif",fontSize:17,color:B.gold,fontWeight:600}}>秀枝</span>
            </div>
            <div>
              <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:17,color:B.gold,letterSpacing:3,fontWeight:600}}>秀枝餐飲事業</div>
              <div style={{fontSize:11,color:B.muted,letterSpacing:2,marginTop:1}}>SIOU JHIH · 訂單管理系統</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:syncColors[syncState],transition:"background 0.3s"}}/>
              <span style={{color:syncColors[syncState]}}>{syncLabels[syncState]}</span>
            </div>
            <button className="bgold" onClick={openNew}>＋ 新增訂單</button>
          </div>
        </div>
        {/* Main nav tabs */}
        <div style={{display:"flex",gap:0,borderTop:`1px solid rgba(200,169,110,0.12)`}}>
          {[["orders",`📋 訂單 (${orders.length})`],["history",`📁 歷史 (${history.length})`],["customers",`👥 客戶 (${Object.keys(customers).length})`]].map(([k,l])=>(
            <button key={k} className={`nav-tab${mainTab===k?" on":""}`} onClick={()=>setMainTab(k)}>{l}</button>
          ))}
        </div>
      </header>

      {/* ══════════════ ORDERS TAB ══════════════ */}
      {mainTab==="orders"&&<>
        {/* Date Tabs */}
        <div style={{background:B.dark,borderBottom:`1px solid rgba(200,169,110,0.1)`,overflowX:"auto",padding:"9px 20px"}}>
          <div style={{display:"flex",gap:5,minWidth:"max-content"}}>
            {dateTabs.map(date=>{
              const lbl=dayLabel(date),cnt=countByDate(date),pu=pickupCount(date),active=date===selDate;
              return(
                <button key={date} onClick={()=>setSelDate(date)} className={`dtab${active?" on":cnt>0?" has":""}`}>
                  {lbl&&<div style={{fontSize:10,marginBottom:1,opacity:0.8}}>{lbl}</div>}
                  <div>{fmtDate(date)}</div>
                  {cnt>0&&<div style={{fontSize:10,marginTop:1,display:"flex",gap:3,justifyContent:"center"}}>
                    <span>{cnt}筆</span>{pu>0&&<span style={{color:active?"#0d1428":"#6ee7b7"}}>自取{pu}</span>}
                  </div>}
                </button>
              );
            })}
          </div>
        </div>
        {/* Stats */}
        <div style={{background:B.dark,borderBottom:`1px solid rgba(200,169,110,0.08)`,padding:"9px 20px",display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
          {[
            {icon:"📋",label:"全部",val:stats.total,color:B.gold},
            {icon:"🛵",label:"外送",val:stats.delivery,color:"#93c5fd"},
            {icon:"🏪",label:"自取",val:stats.pickup,color:"#6ee7b7"},
            {icon:"🧾",label:"發票",val:stats.tax,color:"#c4b5fd"},
            {icon:"💰",label:"總金額",val:`$${stats.amount.toLocaleString()}`,color:B.goldL},
            {icon:"⚠️",label:"未結帳",val:stats.unpaid,color:"#f87171"},
          ].map(s=>(
            <div key={s.label} className="scard">
              <span style={{fontSize:15}}>{s.icon}</span>
              <div><div style={{fontSize:10,color:B.muted}}>{s.label}</div><div style={{fontSize:14,fontWeight:700,color:s.color,fontFamily:"'Noto Serif TC',serif"}}>{s.val}</div></div>
            </div>
          ))}
          <div style={{marginLeft:"auto",display:"flex",gap:5}}>
            {[["all","全部"],["delivery","外送"],["pickup","自取"]].map(([v,l])=>(
              <button key={v} className={`fpill${filter===v?" on":""}`} onClick={()=>setFilter(v)}>{l}</button>
            ))}
          </div>
        </div>
        {/* Order list */}
        <div style={{padding:"14px 20px",display:"flex",flexDirection:"column",gap:9,maxWidth:980,margin:"0 auto"}}>
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:"65px 0"}}>
              <div style={{fontSize:34,marginBottom:10,opacity:0.28}}>◎</div>
              <div style={{fontFamily:"'Noto Serif TC',serif",color:B.muted,letterSpacing:2}}>這天尚無訂單</div>
              <div style={{marginTop:14}}><button className="bgold" style={{fontSize:12,padding:"7px 18px"}} onClick={openNew}>建立第一筆訂單</button></div>
            </div>
          ):filtered.map(o=><OrderCard key={o.id} order={o}/>)}
        </div>
      </>}

      {/* ══════════════ HISTORY TAB ══════════════ */}
      {mainTab==="history"&&(
        <div style={{padding:"16px 20px",maxWidth:980,margin:"0 auto"}}>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
            <input className="inp" style={{maxWidth:320}} value={histSearch} placeholder="搜尋客戶姓名、電話、訂單編號…"
              onChange={e=>setHistSearch(e.target.value)}/>
            <span style={{fontSize:12,color:B.muted}}>共 {history.length} 筆歷史訂單</span>
          </div>
          {histFiltered.length===0?(
            <div style={{textAlign:"center",padding:"50px 0",color:B.muted}}>
              <div style={{fontSize:32,marginBottom:10,opacity:0.3}}>📁</div>
              <div>{history.length===0?"尚無歷史紀錄（訂單完成後歸檔至此）":"查無結果"}</div>
            </div>
          ):histFiltered.map(order=>{
            const amt=cartAmt(order.cart,order.customItems);
            const ps=PAY_STATUS[order.payStatus]||PAY_STATUS.unpaid;
            const items=(order.cart||[]).filter(c=>c.qty>0);
            return(
              <div key={order.id} className="hist-row">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
                  <div>
                    <span style={{fontFamily:"'Noto Serif TC',serif",fontSize:14,fontWeight:600,color:B.white}}>{order.customerName}</span>
                    <span style={{fontSize:12,color:B.muted,marginLeft:8}}>{order.phone}</span>
                    <span style={{fontSize:11,color:B.muted,marginLeft:8}}>📅 {fmtDateFull(order.deliveryDate)} {order.deliveryTime}</span>
                    <span style={{fontSize:11,color:B.muted,marginLeft:8}}>{order.id}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"'Noto Serif TC',serif",fontSize:14,fontWeight:700,color:B.goldL}}>${amt.toLocaleString()}</span>
                    <span className="bdg" style={{color:ps.color,background:ps.bg,borderColor:ps.bd}}>{ps.label}</span>
                  </div>
                </div>
                <div style={{marginTop:5,fontSize:12,color:B.muted}}>
                  {items.map(c=>{const m=MENU.find(m=>m.id===c.menuId);return m?`${m.name}×${c.qty}`:null;}).filter(Boolean).join("、")}
                  {(order.customItems||[]).filter(c=>c.name).map(c=>`✦${c.name}×${c.qty||1}`).join("、")}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════ CUSTOMERS TAB ══════════════ */}
      {mainTab==="customers"&&(
        <div style={{padding:"16px 20px",maxWidth:980,margin:"0 auto"}}>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
            <input className="inp" style={{maxWidth:320}} value={histSearch} placeholder="搜尋姓名或電話…"
              onChange={e=>setHistSearch(e.target.value)}/>
            <span style={{fontSize:12,color:B.muted}}>共 {custList.length} 位客戶</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {custList.filter(c=>!histSearch||c.name.includes(histSearch)||c.phone.includes(histSearch)).map(cust=>{
              const topItemIds = Object.entries(cust.topItems||{}).sort((a,b)=>b[1]-a[1]).slice(0,2);
              return(
                <div key={cust.phone} className="cust-card" onClick={()=>setCustDetail(cust)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:14,fontWeight:600,color:B.white}}>{cust.name}</div>
                      <div style={{fontSize:12,color:B.muted,marginTop:1}}>{cust.phone}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:B.goldL,fontFamily:"'Noto Serif TC',serif"}}>${(cust.totalSpend||0).toLocaleString()}</div>
                      <div style={{fontSize:11,color:B.muted}}>消費 {cust.orderCount||0} 次</div>
                    </div>
                  </div>
                  {cust.address&&<div style={{fontSize:11,color:B.muted,marginBottom:4}}>📍 {cust.address}</div>}
                  {topItemIds.length>0&&(
                    <div style={{fontSize:11,color:B.goldD}}>
                      常點：{topItemIds.map(([id,qty])=>{const m=MENU.find(m=>m.id===Number(id));return m?`${m.name.slice(0,8)}… (${qty}次)`:null;}).filter(Boolean).join("、")}
                    </div>
                  )}
                  {cust.lastOrder&&<div style={{fontSize:10,color:B.muted,marginTop:4}}>最後消費：{fmtDateFull(cust.lastOrder)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Customer Detail Modal ─────────────────────────────────────────── */}
      {custDetail&&(
        <div className="ovl" onClick={()=>setCustDetail(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="deco tl"/><div className="deco tr"/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:18,color:B.gold,fontWeight:600}}>{custDetail.name}</div>
                <div style={{fontSize:13,color:B.muted,marginTop:2}}>{custDetail.phone}</div>
              </div>
              <button className="bgold" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>{
                setForm(f=>({...newForm(selDate),customerName:custDetail.name,phone:custDetail.phone,address:custDetail.address||"",taxId:custDetail.taxId||""}));
                setAddrVal(custDetail.address||""); setEditId(null); setCustDetail(null); setShowForm(true);
              }}>＋ 新增訂單</button>
            </div>
            <div className="gline" style={{margin:"12px 0",opacity:0.35}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
              {[
                {label:"累計消費",val:`$${(custDetail.totalSpend||0).toLocaleString()}`,color:B.goldL},
                {label:"訂單次數",val:`${custDetail.orderCount||0} 次`,color:"#93c5fd"},
                {label:"最後消費",val:custDetail.lastOrder?fmtDateFull(custDetail.lastOrder):"—",color:B.muted},
              ].map(s=>(
                <div key={s.label} style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"10px 12px",border:"1px solid rgba(200,169,110,0.1)"}}>
                  <div style={{fontSize:10,color:B.muted,marginBottom:3}}>{s.label}</div>
                  <div style={{fontSize:14,fontWeight:700,color:s.color,fontFamily:"'Noto Serif TC',serif"}}>{s.val}</div>
                </div>
              ))}
            </div>
            {custDetail.address&&<div style={{fontSize:12,color:B.muted,marginBottom:8}}>📍 {custDetail.address}</div>}
            {custDetail.taxId&&<div style={{fontSize:12,color:"#c4b5fd",marginBottom:8}}>🧾 統編 {custDetail.taxId}</div>}
            {Object.keys(custDetail.topItems||{}).length>0&&(
              <div>
                <div style={{fontSize:11,color:B.goldD,letterSpacing:1,marginBottom:8}}>常點餐點</div>
                {Object.entries(custDetail.topItems).sort((a,b)=>b[1]-a[1]).map(([id,qty])=>{
                  const m=MENU.find(m=>m.id===Number(id)); if(!m) return null;
                  return(
                    <div key={id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.offW,marginBottom:4,background:"rgba(0,0,0,0.15)",borderRadius:6,padding:"6px 10px"}}>
                      <span>{m.name}</span>
                      <span style={{color:B.gold,fontWeight:600}}>共 {qty} 份</span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Past orders */}
            {history.filter(o=>o.phone===custDetail.phone).length>0&&(
              <div style={{marginTop:14}}>
                <div style={{fontSize:11,color:B.goldD,letterSpacing:1,marginBottom:8}}>歷史訂單</div>
                {history.filter(o=>o.phone===custDetail.phone).slice(0,5).map(o=>(
                  <div key={o.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.muted,marginBottom:5,background:"rgba(0,0,0,0.15)",borderRadius:6,padding:"7px 10px"}}>
                    <span>{fmtDateFull(o.deliveryDate)} {o.deliveryTime}</span>
                    <span style={{color:B.offW}}>${cartAmt(o.cart,o.customItems).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="gline" style={{margin:"16px 0 12px",opacity:0.28}}/>
            <button className="bgh" style={{width:"100%",padding:"10px"}} onClick={()=>setCustDetail(null)}>關閉</button>
          </div>
        </div>
      )}

      {/* ── Order Form Modal ──────────────────────────────────────────────── */}
      {showForm&&(
        <div className="ovl">
          <div className="modal">
            <div className="deco tl"/><div className="deco tr"/>
            <div style={{fontFamily:"'Noto Serif TC',serif",fontSize:17,color:B.gold,letterSpacing:2,marginBottom:5}}>{editId?"編輯訂單":"新增訂單"}</div>
            <div className="gline" style={{marginBottom:18,opacity:0.38}}/>

            {/* Basic info */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:13}}>
              {/* Phone with customer autocomplete */}
              <div style={{position:"relative"}} ref={phoneRef}>
                <label className="flbl">聯絡電話（輸入可帶出舊客資料）</label>
                <input className="inp" value={form.phone} placeholder="0912-345-678"
                  onChange={e=>handlePhone(e.target.value)}
                  onFocus={()=>{if(phoneSuggs.length>0)setShowPhone(true);}}
                  autoComplete="off"/>
                {showPhone&&phoneSuggs.length>0&&(
                  <div className="phone-drop">
                    {phoneSuggs.map(cust=>(
                      <div key={cust.phone} className="phone-opt" onClick={()=>fillFromCustomer(cust)}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontWeight:600,color:B.white,fontSize:13}}>{cust.name}</span>
                          <span style={{fontSize:11,color:B.gold}}>{cust.orderCount}次消費</span>
                        </div>
                        <div style={{fontSize:11,color:B.muted,marginTop:2}}>{cust.phone}</div>
                        {cust.address&&<div style={{fontSize:11,color:B.muted,marginTop:1}}>📍 {cust.address}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="flbl">客戶姓名</label>
                <input className="inp" value={form.customerName} placeholder="王小明 / 某某公司" onChange={e=>setForm({...form,customerName:e.target.value})}/>
              </div>
              <div>
                <label className="flbl">統一編號（需發票請填）</label>
                <input className="inp" value={form.taxId} placeholder="留空不需發票" onChange={e=>setForm({...form,taxId:e.target.value})}/>
              </div>
              <div></div>
              <div>
                <label className="flbl">配送日期</label>
                <input className="inp" type="date" value={form.deliveryDate} onChange={e=>setForm({...form,deliveryDate:e.target.value})}/>
              </div>
              <div>
                <label className="flbl">配送時間</label>
                <input className="inp" type="time" value={form.deliveryTime} onChange={e=>setForm({...form,deliveryTime:e.target.value})}/>
              </div>
            </div>

            {/* ── 修改：POS 單號欄位移到這裡，外送和自取都顯示，跟取餐方式完全分開 ── */}
            <div style={{marginBottom:13}}>
              <label className="flbl">🖨️ POS 自取單號 1~20（外送 / 自取皆可填）</label>
              <select className="inp" value={form.posNo} onChange={e=>setForm({...form,posNo:e.target.value})}
                style={{fontFamily:"'Noto Serif TC',serif",fontWeight:700,fontSize:15,color:form.posNo?"#fbbf24":"#8a8fa8",background:"#0d1428"}}>
                <option value="">— 不填 / 跳過 —</option>
                {Array.from({length:20},(_,i)=>i+1).map(n=>(
                  <option key={n} value={String(n)}>🖨️ POS #{n}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div style={{marginBottom:13}}>
              <label className="flbl">取餐方式</label>
              <div style={{display:"flex",gap:8}}>
                {[["delivery","🛵  外送"],["pickup","🏪  自取"]].map(([v,l])=>(
                  <button key={v} onClick={()=>handleTypeChange(v)}
                    style={{flex:1,background:form.type===v?"rgba(200,169,110,0.14)":"transparent",color:form.type===v?B.gold:B.muted,border:`1px solid ${form.type===v?B.goldD:"rgba(200,169,110,0.18)"}`,borderRadius:7,padding:"9px",fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",transition:"all 0.2s"}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {form.type==="delivery"&&(
              <div style={{marginBottom:13,position:"relative"}} ref={addrRef}>
                <label className="flbl">配送地址</label>
                <input className="inp" value={addrVal} placeholder="輸入縣市、區或街道名稱…"
                  onChange={e=>handleAddr(e.target.value)}
                  onFocus={()=>{if(addrSuggs.length>0)setShowAddr(true);}}
                  autoComplete="off"/>
                {showAddr&&addrSuggs.length>0&&(
                  <div className="adrop">
                    {addrSuggs.map((s,i)=>(
                      <div key={i} className="aopt" onClick={()=>pickAddr(s)}>
                        <span className="atag">{s.area}</span><span>{s.st}</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:B.muted}}>補充門牌 →</span>
                      </div>
                    ))}
                  </div>
                )}
                {form.address&&!showAddr&&!/\d/.test(form.address)&&(
                  <div style={{fontSize:11,color:"#fbbf24",marginTop:3}}>⚠ 請補充門牌號碼</div>
                )}
              </div>
            )}

            {/* Payment */}
            <div style={{marginBottom:13}}>
              <label className="flbl">付款方式</label>
              <div style={{display:"flex",gap:7}}>
                {Object.entries(PAY_METHOD).map(([k,v])=>(
                  <button key={k} className={`pbtn${form.payMethod===k?" on":""}`} onClick={()=>setForm({...form,payMethod:k})}>
                    <div style={{fontSize:17,marginBottom:2}}>{v.icon}</div><div>{v.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label className="flbl">付款狀態</label>
              <div style={{display:"flex",gap:7}}>
                {Object.entries(PAY_STATUS).map(([k,v])=>(
                  <button key={k} onClick={()=>setForm({...form,payStatus:k})}
                    style={{flex:1,background:form.payStatus===k?v.bg:"transparent",color:form.payStatus===k?v.color:B.muted,border:`1px solid ${form.payStatus===k?v.bd:"rgba(200,169,110,0.18)"}`,borderRadius:7,padding:"9px",fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",transition:"all 0.2s",fontWeight:form.payStatus===k?600:400}}>
                    {k==="unpaid"?"✗ 未結帳":"✓ 已匯款 / 已付"}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu */}
            <div style={{marginBottom:7}}>
              <label className="flbl" style={{marginBottom:8}}>選擇餐點</label>
              {MENU.map(m=>{
                const c=form.cart.find(c=>c.menuId===m.id)||{qty:0,note:""};
                return(
                  <div key={m.id} className={`mrow${c.qty>0?" on":""}`}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:c.qty>0?B.white:B.muted,lineHeight:1.4,transition:"color 0.18s"}}>{m.name}</div>
                      <div style={{fontSize:11,color:c.qty>0?B.gold:B.goldD,marginTop:1}}>NT$ {m.price}</div>
                    </div>
                    {c.qty>0&&<input className="inote" value={c.note} placeholder="備註…" onChange={e=>setINote(m.id,e.target.value)}/>}
                    <button className="qbtn" disabled={c.qty===0} onClick={()=>setQty(m.id,-1)}>－</button>
                    <span className="qn">{c.qty}</span>
                    <button className="qbtn" onClick={()=>setQty(m.id,1)}>＋</button>
                  </div>
                );
              })}
            </div>

            {/* Custom items */}
            <div style={{marginBottom:13}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <label className="flbl" style={{marginBottom:0}}>客製化餐盒</label>
                <button onClick={()=>setForm(f=>({...f,customItems:[...(f.customItems||[]),{name:"",qty:1,price:"",note:""}]}))}
                  style={{background:"rgba(252,211,77,0.1)",color:"#fcd34d",border:"1px solid rgba(252,211,77,0.25)",borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
                  ＋ 新增客製
                </button>
              </div>
              {(form.customItems||[]).map((ci,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8,background:"rgba(252,211,77,0.04)",border:"1px solid rgba(252,211,77,0.15)",borderRadius:8,padding:"10px 10px 8px"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input className="inp" value={ci.name} placeholder="品名" style={{flex:3,background:"#0d1428"}} onChange={e=>setForm(f=>({...f,customItems:f.customItems.map((c,j)=>j===i?{...c,name:e.target.value}:c)}))}/>
                    <input className="inp" value={ci.qty} type="number" min="1" placeholder="數量" style={{width:62,background:"#0d1428",textAlign:"center"}} onChange={e=>setForm(f=>({...f,customItems:f.customItems.map((c,j)=>j===i?{...c,qty:e.target.value}:c)}))}/>
                    <input className="inp" value={ci.price} type="number" placeholder="單價" style={{width:82,background:"#0d1428",color:"#fcd34d",fontWeight:600}} onChange={e=>setForm(f=>({...f,customItems:f.customItems.map((c,j)=>j===i?{...c,price:e.target.value}:c)}))}/>
                    <button onClick={()=>setForm(f=>({...f,customItems:f.customItems.filter((_,j)=>j!==i)}))} style={{background:"rgba(248,113,113,0.1)",color:"#f87171",border:"1px solid rgba(248,113,113,0.25)",borderRadius:6,padding:"4px 8px",cursor:"pointer",flexShrink:0,fontSize:13}}>✕</button>
                  </div>
                  <textarea className="inp" value={ci.note} placeholder="備註（可輸入較長內容）…" rows={2}
                    style={{width:"100%",background:"#0d1428",fontSize:12,resize:"vertical",lineHeight:1.6}}
                    onChange={e=>setForm(f=>({...f,customItems:f.customItems.map((c,j)=>j===i?{...c,note:e.target.value}:c)}))}/>
                </div>
              ))}
            </div>

            {/* Cart summary */}
            {(activeItems.length>0||(form.customItems||[]).some(c=>c.price))&&(
              <div className="csum" style={{marginBottom:13}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:11,color:B.goldD,letterSpacing:1}}>訂單小計</span>
                  <span style={{fontFamily:"'Noto Serif TC',serif",fontSize:19,fontWeight:700,color:B.goldL}}>NT$ {formTotal.toLocaleString()}</span>
                </div>
                {activeItems.map(c=>{const m=MENU.find(m=>m.id===c.menuId);if(!m)return null;return(
                  <div key={c.menuId} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.muted,marginTop:3}}>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:8}}>{m.name} ×{c.qty}{c.note?` (${c.note})`:""}</span>
                    <span style={{color:B.offW,flexShrink:0}}>NT$ {(m.price*c.qty).toLocaleString()}</span>
                  </div>
                );})}
                {(form.customItems||[]).filter(c=>c.price).map((c,i)=>(
                  <div key={"ci"+i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#fcd34d",marginTop:3}}>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:8}}>✦ {c.name||"客製餐盒"} ×{c.qty||1}</span>
                    <span style={{flexShrink:0}}>NT$ {(Number(c.price)*Number(c.qty||1)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{marginBottom:18}}>
              <label className="flbl">訂單備註</label>
              <textarea className="inp" value={form.note} placeholder="整筆訂單特殊需求、注意事項…"
                onChange={e=>setForm({...form,note:e.target.value})} rows={2} style={{resize:"vertical"}}/>
            </div>

            <div className="gline" style={{marginBottom:13,opacity:0.28}}/>
            <div style={{display:"flex",gap:9}}>
              <button onClick={()=>setShowForm(false)} className="bgh" style={{flex:1,padding:"10px"}}>取　消</button>
              <button onClick={save} className="bgold" style={{flex:2,padding:"10px"}}>{editId?"儲存修改":"建立訂單"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
