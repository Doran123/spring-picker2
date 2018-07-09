import React from 'react';
//import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

const getIndex = (list, value) => {
  if (list && list.length < 1) {
    return 0;
  }
  const index = list.findIndex((item)=>item.value === value);
  if (index < 0) {
    console.warn(`指定的value:${value}不存在`);
  }
  return index;
}

const existValue = (val)=>!!~'number,string'.indexOf(typeof val);
const defaultProps = {
  viewCount: 7
}
const reqAF = require('./reqAF');

class Picker extends React.Component {
  constructor(props) {
    super();
    this.props = props;
    this.startY = 0;
    this.endY   = 0;
    //当前拖动的Y坐标
    this.currentY = 0;
    this.itemHeight = 36;
    this.selectedIndex = this.getInitialIndex();
    this.state = {style: {}};
    this.viewCount = props.viewCount % 2 ? props.viewCount : props.viewCount + 1;//要奇数
    this.halfCount = this.viewCount / 2 | 0;

    // 正数y最大值
    this.max = this.halfCount * this.itemHeight;
    // 负数y最小值
    this.min = -(this.props.data.length - this.halfCount - 1) * this.itemHeight;
  }

  // 初始化获得selectedIndex
  getInitialIndex() {
    let index;
    if (!existValue(this.props.selectedValue)) {
      if(this.props.data.length > 3){
        index = Math.floor(this.props.data.length / 2);
        
      }else{
        index = 0;
      }
      //没指定value，选了index后定义对应的value
      this.setSelectedValue(index, 'init')
    }else{
      index = getIndex(
        this.props.data,
        this.props.selectedValue
      );
      //制定value不存在
      if(index < 0){
        index = 0;
        this.setSelectedValue(index,'init');
      }
    }
    return index;
  }
  componentWillReceiveProps(nextProps) {
    const isEqual = nextProps.selectedValue === this.props.selectedValue;

    if (!isEqual) {
      this.selectedIndex = getIndex(nextProps.data, nextProps.selectedValue);
      if (this.selectedIndex === 0) {
        //这是干嘛的？
        this.setTransForm(this.itemHeight * this.halfCount);
      }
    }
  }

  getStyle (selectedIndex) {
    let y;
    if (selectedIndex > this.halfCount) {
      y = - (selectedIndex - this.halfCount) * this.itemHeight;
    } else {
      y = (this.halfCount - selectedIndex) * this.itemHeight;
    }
    return y;
  }
  setTransForm(y, type){
    if(!this.dom) return;

    const val = `translate3d(0px, ${y}px, 0px)`;
    const run = ()=>{
      this.dom.style.webkitTransform = val;
      this.dom.style.transform = val;
      if(type === 'end'){
        this.dom.style.transition = '';
      }else{
        this.dom.style.transition = 'none';
      }
    };
    if(type === 'ins'){
      run()
    }else{
      reqAF(run);
    }

    // item scale
    const n = this.countListIndex(y)|0;
    //console.log(n)
    for(let i = n - this.halfCount; i<n+this.halfCount+1; i++){
      if(typeof this.dom.childNodes[i] === 'undefined') continue;

      const oriPos = this.getStyle(i);
      const scale = 1 - Math.abs(oriPos-y)  / 8 / this.itemHeight;
      console.log(scale);
      //let origin;
      //let transY = this.itemHeight * (1 - Math.pow(scale, Math.abs(i-n)));
      // if(i<=n){
      //   origin = `center ${transY*3}px`;
      // }else{
      //   origin = `center ${-transY}px`;
      //   //transY = -transY;
      // }

      //this.dom.childNodes[i].style.transform = `scale(${scale}) translate3d(0,${transY}px,0)`;
      this.dom.childNodes[i].style.transform = `scale(${scale})`;
      this.dom.childNodes[i].style.transformOrigin = i<=n ? 'bottom' : 'top';
    }console.log('end')
  }

  stopEase(idPointer){
    if(this[idPointer]){
      delete this[idPointer];
      if(this._easingY!==null){
        this.currentY = this._easingY;
      }
    }
  }
  /**
   * 滑动结束后，设置缓动
   * @param {number} _rawY  touchend后，滚动到的y位置
   * @param {function} cb   完成后回调
   */
  setEase(_rawY, cb){
    const _maxSpeed = 3;
    let v0 = this.endGetSpeed();
    if(!v0) return cb(_rawY);

    if(v0 > _maxSpeed) v0 = _maxSpeed;
    else if(v0 < -_maxSpeed) v0 = -_maxSpeed;

    const _pointerId = '_ease_' + Math.random()*1e5|0;
    this[_pointerId] = true;

    const sym = v0 > 0 ? 1 : -1;
    const frame = 1000 / 60, 
          _oriG = sym * .003,
          obs = _oriG + sym * .01;

    let g = _oriG;
    let t = 0;
    let h0 = 0;
    let _maxH; //最终结果的最大滑动距离
    if(v0 > 0) _maxH = this.max - _rawY;
    else _maxH = _rawY - this.min;

    //console.log(v0);
    //console.log('totalTime:'+Math.abs(v0 / g))
 
    const run = (frameCb, done)=>{
        reqAF(()=>{
          t += frame;
          const ht = (v0 - g * t / 2) * t + h0;
          const vt = v0 - g * t;

          // 超过边界, 增加阻力
          if(g !== obs && Math.abs(ht) > _maxH){
            g = obs;
            v0 = vt;
            t = 0;
            h0 = ht;
          }
          // 到达顶点
          if(vt * sym < 0 ){
            return done(ht + _rawY);
          }
          
          if(frameCb(ht + _rawY) === false){
            return;
          }
          return run(frameCb, done);
        })
    };

    run((y)=>{
      if(!this[_pointerId]) return false;
      this._easingY = y;
      this.setTransForm(y, 'ins');
      
    }, y=>{
      this._easingY = null;
      cb(y)
    });

    return _pointerId;
  }
  // touchend后，获取最后的滑动速度
  endGetSpeed(){
    //if(!this.nowT || this.lastT === this.nowT) return 0;

    //const speed = (this.nowY - this.lastY) / (this.nowT - this.lastT);
    const s = this.lastScrollSpeed;
    this._resetSpeed();
    return s;

  }
  _resetSpeed(){
    this.lastT = this.lastY = this.lastScrollSpeed = 0;
  }
  // 缓存 lastT lastY lastScrollSpeed。 暂设置lastScrollSpeed是之前综合的平均值
  updSpeed(y){
    const nowT = Date.now();
    const nowY = y;
    /* move的触发间隔大于某个数，就当作触摸停顿了，不再计算速度 */
    if(!this.lastT || (nowT - this.lastT)>50){
      this.lastT  = nowT;
      this.lastY  = nowY;
      this.lastScrollSpeed = 0;
    }else{
      const _lastS = this.lastScrollSpeed;
      this.lastScrollSpeed = (nowY - this.lastY) / (nowT - this.lastT);
      
      if(_lastS){
        this.lastScrollSpeed = (this.lastScrollSpeed+_lastS)/2;
      }
      this.lastT = nowT;
      this.lastY = nowY;

      
    }
  }
  // 完成滚动后，修正滚动的位置到最近某个选项的y。
  fixPos(rawY){
    return Math.round(rawY / this.itemHeight) * this.itemHeight;  
  }
  /**
   * 当y超过范围，自动把this.currentY 修正到边缘值，修正后返回true，没则返回false
   * @param {number} _rawY 
   * @returns {boolean}
   */
  fixEdgePos(_rawY){
    if (_rawY > this.max) {
      this.currentY = this.max;
      return true;
    }
    else if (_rawY < this.min) {
      this.currentY =  this.min;
      return true;
    }else{
      return false;
    }
  }

  // 滚动完后
  handleTransEnd(){
    const n = this.countListIndex(this.currentY);
    this.setSelectedValue(n);
    this.setTransForm(this.currentY, 'end');
  }
  handleTouchStart (e) {
    e.preventDefault();
    if (this.props.data.length <= 1) {
      return;
    }
    this.startY = e.changedTouches[0].pageY;
    this.stopEase(this._easeIDPointer);
  }

  handleTouchEnd(e) {
    e.preventDefault();
    if (this.props.data.length <= 1) {
      return;
    }
    this.endY = e.changedTouches[0].pageY;
    // 实际滚动距离
    const _rawY = +(this.endY - this.startY) + this.currentY;

    
    if(this.fixEdgePos(_rawY)){
      this._resetSpeed();
      this.handleTransEnd();
      
    }else{
      this._easeIDPointer = this.setEase(_rawY, (easeEndY)=>{
        if(!this.fixEdgePos(easeEndY)){
          this.currentY = this.fixPos(easeEndY)
        }
        this.handleTransEnd();
        
      });
    }

  
  }

  handleTouchMove (e) {
    e.preventDefault();
    if (this.props.data.length <= 1) {
      return;
    }
    const pageY = e.changedTouches[0].pageY;
    let value = +(pageY - this.startY);
    const y = this.currentY + value;
    
    this.updSpeed(y);
    this.setTransForm(y);
  }

  // 计算list数组索引
  countListIndex (pageY) {
    let n = pageY / this.itemHeight;
    n = n > 0 ? this.halfCount - n : Math.abs(n) + this.halfCount;
    return n;
  }

  // set选中值
  setSelectedValue (index, type) {
    const length = this.props.data.length;
    if (length === 0) {
      this.callback({});
      return;
    }
    if (index < 0 ) index = 0;
    if(index > length -1) index = length -1;

    const item = this.props.data[index];
    this.selectedIndex = index;

    this.callback(item, type)
  }

  // 回调
  callback (item, type) {
    if(type==='init'){
        this._triggerChangeWhenMount = item;
    }else{
      this.props.onChange(item.value, item.name);
    }
  }

  getSelectedClass (index) {
    if (this.selectedIndex === index) {
      return 'ui-picker-item-selected';
    }
    return '';
  }

  componentDidMount () {
    /* onTouchStart={this.handleTouchStart.bind(this)}
            onTouchMove={this.handleTouchMove.bind(this)}
            onTouchEnd = {this.handleTouchEnd.bind(this)} */

    if(this.dom){
      this.dom.addEventListener('touchstart', this.handleTouchStart.bind(this));
      this.dom.addEventListener('touchmove', this.handleTouchMove.bind(this), false);
      this.dom.addEventListener('touchend', this.handleTouchEnd.bind(this), true);
      this.dom.addEventListener('touchcancel', this.handleTouchEnd.bind(this));
    }
    if(this._triggerChangeWhenMount){
        this.callback(this._triggerChangeWhenMount);
        this._triggerChangeWhenMount = null;
    }
    this.currentY = this.getStyle(this.selectedIndex);
    this.setTransForm(this.currentY);
  }

  handleWrapperStart (e) {
    e.preventDefault();
  }

  render () {
    return (
      <div className="ui-picker-wrapper" onTouchStart={this.handleWrapperStart.bind(this)}>
          <div className="ui-picker"
            ref={dom=>this.dom = dom}>
            {
              this.props.data.map((item, index) => {
                const displayValue = item.name;
                return <div key={index}
                  className={ 'ui-picker-item ' + this.getSelectedClass(index)}>
                  {displayValue}
                </div>
              })
            }
          </div>
          <div className="ui-picker-deco" />
          <div className="ui-picker-center"/>
      </div>
    )
  }
}
Picker.defaultProps = defaultProps;
Picker.propTypes = {
  // 数据源
  data: PropTypes.array.isRequired,
  // 选中的value
  selectedValue: PropTypes.any,
  // 当停止滑动选中立即回调onchange方法
  onChange: PropTypes.func,
  viewCount: PropTypes.number
};

export default Picker;
